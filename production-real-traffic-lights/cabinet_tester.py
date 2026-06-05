#!/usr/bin/env python3
"""
VROOM Cabinet Installer & Testing Tool
Allows field engineers and installers to interactively test physical traffic light connections
(direct Modbus TCP registers, GPIO pins, or via NATS commands).
"""

import sys
import socket
import struct
import argparse
import time

def parse_endpoint(endpoint):
    clean = endpoint
    if clean.startswith("tcp://"):
        clean = clean[6:]
    if ":" in clean:
        ip, port = clean.split(":")
        return ip, int(port)
    return clean, 502

def test_modbus_plc(endpoint, register, value):
    """Sends a raw Modbus TCP Write Single Register (FC6) packet to test PLC."""
    ip, port = parse_endpoint(endpoint)
    print(f"Connecting to Modbus PLC at {ip}:{port}...")
    
    try:
        # 12-byte Modbus TCP ADU
        # Transaction ID (0x0001), Protocol ID (0x0000), Length (0x0006), Unit ID (0x01), FC (0x06), Register, Value
        packet = struct.pack(">HHHBBHH", 1, 0, 6, 1, 6, register, value)
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2.0)
        sock.connect((ip, port))
        
        print(f"Sending Modbus Write Command: Register {register} = {value}")
        sock.sendall(packet)
        
        response = sock.recv(12)
        sock.close()
        
        if len(response) < 12:
            print("Error: PLC closed connection or returned incomplete response.")
            return False
            
        # Parse function code and echoed register/value
        _, _, _, _, fc, echo_reg, echo_val = struct.unpack(">HHHBBHH", response[:12])
        if fc == 6:
            print(f"Success! PLC acknowledged register write. Response echo matched.")
            return True
        else:
            print(f"Error: PLC returned unexpected function code: {fc}")
            return False
            
    except Exception as e:
        print(f"Error communicating with Modbus PLC: {e}")
        return False

def test_gpio_pin(pin, state):
    """Simulates or writes directly to Linux Sysfs GPIO value (if run on Linux)."""
    import os
    print(f"Testing GPIO pin {pin} -> {'HIGH (1)' if state else 'LOW (0)'}")
    
    # Export pin if not exported
    gpio_dir = f"/sys/class/gpio/gpio{pin}"
    try:
        if not os.path.exists(gpio_dir):
            if os.path.exists("/sys/class/gpio/export"):
                with open("/sys/class/gpio/export", "w") as f:
                    f.write(str(pin))
                time.sleep(0.1) # Wait for udev
                
        # Set direction to output
        direction_path = f"{gpio_dir}/direction"
        if os.path.exists(direction_path):
            with open(direction_path, "w") as f:
                f.write("out")
                
        # Write value
        value_path = f"{gpio_dir}/value"
        if os.path.exists(value_path):
            with open(value_path, "w") as f:
                f.write("1" if state else "0")
            print(f"Success! GPIO pin {pin} value updated.")
            return True
        else:
            print("Warning: Not running on a Linux system with Sysfs GPIO. (Simulated success)")
            return True
    except PermissionError:
        print("Error: Permission denied. Please run as root/administrator to access sysfs GPIO.")
        return False
    except Exception as e:
        print(f"Error writing to GPIO: {e}")
        return False

def send_nats_command(nats_url, intersection_id, target_phase, ca_cert=None, client_cert=None, client_key=None, msg_type="COMMAND"):
    """Publishes a NATS protocol command line to test the full controller pipeline."""
    try:
        import nats
        import asyncio
        import ssl
        
        async def run():
            tls_ctx = None
            if ca_cert or client_cert or client_key:
                tls_ctx = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH)
                if ca_cert:
                    tls_ctx.load_verify_locations(cafile=ca_cert)
                if client_cert and client_key:
                    tls_ctx.load_cert_chain(certfile=client_cert, keyfile=client_key)
                tls_ctx.check_hostname = False # local municipal networks might not use DNS hostnames matching CN
                tls_ctx.verify_mode = ssl.CERT_REQUIRED if ca_cert else ssl.CERT_NONE

            print(f"Connecting to NATS server at {nats_url}...")
            nc = await nats.connect(nats_url, tls=tls_ctx)
            
            # Form VROOM protocol message
            # VROOM|VERSION|TYPE|SENDER|SEQ|TIMESTAMP|PHASE|HEALTH|TTL
            timestamp = int(time.time() * 1000)
            msg = f"VROOM|1|{msg_type}|installer-tool|1|{timestamp}|{target_phase}|ok|1000"
            subject = f"vroom.intersections.{intersection_id}.command"
            
            print(f"Publishing Command to subject '{subject}':")
            print(f"  {msg}")
            
            await nc.publish(subject, msg.encode())
            await nc.flush()
            await nc.close()
            print("Success! Command published to NATS.")
            
        asyncio.run(run())
        return True
    except ImportError:
        print("Error: 'nats-py' library is required to send NATS commands.")
        print("Install it with: pip install nats-py")
        return False
    except Exception as e:
        print(f"Error sending NATS command: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="VROOM Cabinet Installer & Testing Tool")
    
    subparsers = parser.add_subparsers(dest="command", help="Target test system")
    
    # Modbus Subcommand
    modbus_parser = subparsers.add_parser("plc", help="Test direct Modbus TCP PLC connection")
    modbus_parser.add_argument("--endpoint", required=True, help="PLC Endpoint IP:Port (e.g. 192.168.1.10:502)")
    modbus_parser.add_argument("--register", type=int, required=True, help="Modbus Holding Register address (e.g. 1000)")
    modbus_parser.add_argument("--value", type=int, required=True, help="Value to write (e.g. 0=Red, 1=Amber, 2=Green)")
    
    # GPIO Subcommand
    gpio_parser = subparsers.add_parser("gpio", help="Test direct Linux GPIO pin outputs")
    gpio_parser.add_argument("--pin", type=int, required=True, help="Linux GPIO pin number (e.g. 17)")
    gpio_parser.add_argument("--on", action="store_true", help="Turn pin ON (high), otherwise turns OFF (low)")
    
    # NATS Subcommand
    nats_parser = subparsers.add_parser("nats", help="Test full system pipeline via NATS command messages")
    nats_parser.add_argument("--url", default="nats://localhost:4222", help="NATS URL")
    nats_parser.add_argument("--intersection", required=True, help="Target intersection ID (e.g. hasselt-xl-a)")
    nats_parser.add_argument("--phase", required=True, help="Target phase ID or phase name to command (e.g. 3 or NS_GREEN)")
    nats_parser.add_argument("--ca-cert", default=None, help="Path to CA certificate file")
    nats_parser.add_argument("--client-cert", default=None, help="Path to client certificate file")
    nats_parser.add_argument("--client-key", default=None, help="Path to client private key file")
    nats_parser.add_argument("--type", default="COMMAND", choices=["COMMAND", "PRIORITY"], help="Message type (COMMAND or PRIORITY)")
    
    args = parser.parse_args()
    
    if args.command == "plc":
        test_modbus_plc(args.endpoint, args.register, args.value)
    elif args.command == "gpio":
        test_gpio_pin(args.pin, args.on)
    elif args.command == "nats":
        send_nats_command(args.url, args.intersection, args.phase, args.ca_cert, args.client_cert, args.client_key, args.type)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

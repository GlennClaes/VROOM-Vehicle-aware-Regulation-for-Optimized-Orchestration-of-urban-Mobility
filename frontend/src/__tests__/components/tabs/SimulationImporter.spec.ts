import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { h } from 'vue';
import SimulationImporter from '../../../components/tabs/SimulationImporter.vue';
import { simulationService } from '../../../services/simulationService';

// Mock simulationService
vi.mock('../../../services/simulationService', () => ({
  simulationService: {
    saveResult: vi.fn()
  }
}));

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  Upload: { render: () => h('div') },
  AlertTriangle: { render: () => h('div') },
  CheckCircle2: { render: () => h('div') }
}));

describe('SimulationImporter.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dropzone initially', () => {
    const wrapper = mount(SimulationImporter);
    expect(wrapper.find('.dropzone').exists()).toBe(true);
    expect(wrapper.text()).toContain('Sleep een geëxporteerd CSV-bestand hierheen');
  });

  it('rejects file upload if not a CSV file', async () => {
    const wrapper = mount(SimulationImporter);
    const mockFile = { name: 'simulation_results.txt' };
    
    wrapper.vm.handleFileUpload({ target: { files: [mockFile] } });

    expect(wrapper.vm.importError).toContain('geen CSV-bestand');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.alert-danger').exists()).toBe(true);
    expect(wrapper.text()).toContain('Validatiefout');
  });

  it('rejects invalid/empty CSV content', async () => {
    const wrapper = mount(SimulationImporter);
    const mockFile = new File([''], 'empty.csv', { type: 'text/csv' });
    
    vi.spyOn(window, 'FileReader').mockImplementation(function() {
      this.readAsText = () => {
        this.onload({ target: { result: '' } });
      };
    });

    wrapper.vm.handleFileUpload({ target: { files: [mockFile] } });

    expect(wrapper.vm.importError).toContain('leeg of bevat geen dataregels');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('leeg of bevat geen dataregels');
    
    vi.restoreAllMocks();
  });

  it('rejects CSV with missing essential columns', async () => {
    const wrapper = mount(SimulationImporter);
    const invalidCsvContent = 'Time (s),TNR\n0.0,0.0';
    const mockFile = new File([invalidCsvContent], 'invalid_headers.csv', { type: 'text/csv' });

    vi.spyOn(window, 'FileReader').mockImplementation(function() {
      this.readAsText = () => {
        this.onload({ target: { result: invalidCsvContent } });
      };
    });

    wrapper.vm.handleFileUpload({ target: { files: [mockFile] } });

    expect(wrapper.vm.importError).toContain('Essentiële kolommen ontbreken');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Essentiële kolommen ontbreken');

    vi.restoreAllMocks();
  });

  it('successfully parses, validates and previews valid VROOM-exported CSV file', async () => {
    const wrapper = mount(SimulationImporter);
    const validCsvContent = `Time (s),TNR,TAWT (s),EWPC (s),AQL (veh),AvgV (m/s),AWT (s),Count (veh),TP (veh),DLY (s),PRS,TTT (s),NQL,JFI,RAT
10.0,1.2,10,2.5,0.4,12.5,2.5,15,5,1.2,0.8,40.0,0.012,0.85,0.042
20.0,1.8,20,3.5,0.6,10.0,3.5,20,10,1.5,1.0,60.0,0.018,0.82,0.038`;

    const mockFile = new File([validCsvContent], 'traffic_kpis_rush_hour_ai.csv', { type: 'text/csv' });

    vi.spyOn(window, 'FileReader').mockImplementation(function() {
      this.readAsText = () => {
        this.onload({ target: { result: validCsvContent } });
      };
    });

    wrapper.vm.handleFileUpload({ target: { files: [mockFile] } });

    expect(wrapper.vm.importError).toBeNull();
    expect(wrapper.vm.parsedSummary).toBeDefined();
    
    expect(wrapper.vm.parsedSummary.avgQueue).toBe(0.5);
    expect(wrapper.vm.parsedSummary.avgWait).toBe(3.0);
    expect(wrapper.vm.parsedSummary.avgSpeed).toBe(40.5);
    expect(wrapper.vm.parsedSummary.throughput).toBe(10);
    expect(wrapper.vm.parsedSummary.totalVehicles).toBe(20);

    expect(wrapper.vm.importForm.scenario).toBe('Rush Hour Ai');
    expect(wrapper.vm.importForm.strategy).toBe('AI Adaptief (SAM)');
    expect(wrapper.vm.importForm.modelName).toBe('SAM Model');
    expect(wrapper.vm.importForm.network).toBe('Hasselt XL');

    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Bestand gevalideerd');

    vi.restoreAllMocks();
  });

  it('cancels import and resets form when Annuleren is clicked', async () => {
    const wrapper = mount(SimulationImporter);
    wrapper.vm.parsedSummary = { avgQueue: 0.5, avgWait: 2.0, avgSpeed: 30, throughput: 10, totalVehicles: 15, totalSteps: 2 };
    wrapper.vm.parsedHistory = [{ time: 10 }];
    wrapper.vm.importError = 'Some prior error';

    wrapper.vm.cancelImport();

    expect(wrapper.vm.parsedSummary).toBeNull();
    expect(wrapper.vm.parsedHistory).toEqual([]);
    expect(wrapper.vm.importError).toBeNull();
    expect(wrapper.vm.importForm.scenario).toBe('');
  });

  it('saves imported simulation, emits imported event, and clears imports', async () => {
    const saveResultSpy = vi.spyOn(simulationService, 'saveResult').mockResolvedValue({ id: 99 });

    const wrapper = mount(SimulationImporter);
    wrapper.vm.parsedSummary = {
      avgQueue: 0.5,
      avgWait: 3.0,
      avgSpeed: 40.5,
      teleports: 0,
      throughput: 10,
      totalVehicles: 20,
      totalSteps: 2
    };
    wrapper.vm.parsedHistory = [{ time: 10 }, { time: 20 }];
    wrapper.vm.importForm = {
      scenario: 'Rush Hour Ai',
      strategy: 'AI Adaptief (SAM)',
      modelName: 'SAM Model',
      network: 'Hasselt XL'
    };

    await wrapper.vm.saveImportedSimulation();

    expect(saveResultSpy).toHaveBeenCalledWith({
      strategy: 'AI Adaptief (SAM)',
      model_name: 'SAM Model',
      scenario: 'Rush Hour Ai',
      network: 'Hasselt XL',
      avg_queue: 0.5,
      avg_speed: 40.5,
      avg_wait_time: 3.0,
      teleports: 0,
      throughput: 10,
      total_vehicles: 20,
      total_steps: 2,
      data_points: JSON.stringify([{ time: 10 }, { time: 20 }])
    });

    expect(wrapper.emitted().imported).toBeTruthy();
    expect(wrapper.vm.parsedSummary).toBeNull();

    saveResultSpy.mockRestore();
  });
});

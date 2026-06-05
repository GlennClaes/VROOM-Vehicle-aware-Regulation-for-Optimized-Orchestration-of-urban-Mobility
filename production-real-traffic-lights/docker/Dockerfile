FROM alpine:3.20 AS build

RUN apk add --no-cache cmake g++ make

WORKDIR /src
COPY . .

RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --parallel \
    && ctest --test-dir build --output-on-failure

FROM alpine:3.20

RUN adduser -D -h /app vroom

WORKDIR /app
COPY --from=build /src/build/vroom-real-controller /usr/local/bin/vroom-real-controller
COPY config ./config

USER vroom

ENTRYPOINT ["vroom-real-controller"]

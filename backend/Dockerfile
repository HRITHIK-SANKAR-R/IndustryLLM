FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM gcr.io/distroless/static-debian12
WORKDIR /app
COPY --from=build /out/server ./server
COPY --from=build /src/mock_data ./mock_data
ENV PORT=8080
ENV MOCK_DIR=mock_data
EXPOSE 8080
ENTRYPOINT ["./server"]

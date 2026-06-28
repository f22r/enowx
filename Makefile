.PHONY: web build dev run tidy

web:
	cd web && npm run build
	rm -rf server/webdist && cp -r web/dist server/webdist

build: web
	CGO_ENABLED=0 go build -o bin/enowx ./cmd/enowx

run:
	CGO_ENABLED=0 go run ./cmd/enowx

dev: build
	./bin/enowx

tidy:
	go mod tidy

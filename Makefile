.PHONY: dev build compile test deploy lint

dev:
	bun run dev

build:
	bun run build

compile:
	bun run compile

test:
	bun run test

deploy:
	bun run deploy

lint:
	bun run lint

.PHONY: dev build compile test test-contract deploy lint

dev:
	npm run dev

build:
	npm run build

compile:
	npm run compile

test:
	npm test

test-contract:
	npm run test:contract

deploy:
	npm run deploy

lint:
	npm run lint

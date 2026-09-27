# GridPulse — developer targets
PY := .venv/bin/python
NPM := . $$HOME/.nvm/nvm.sh >/dev/null 2>&1; npm --prefix frontend
.PHONY: setup dev api web test acceptance pipeline lint e2e

setup:
	python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
	$(NPM) ci

api:
	$(PY) -m uvicorn app.main:app --app-dir backend --reload --port 8000

web:
	$(NPM) run dev

dev:
	$(MAKE) -j2 api web

test:
	$(PY) -m pytest -q
	$(NPM) test

acceptance:
	$(PY) -m pytest -q tests/test_acceptance.py

pipeline:
	$(PY) -m pipeline.build

lint:
	.venv/bin/ruff check pipeline engine backend ai tests

e2e:
	$(NPM) run e2e

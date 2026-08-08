# Thin wrappers over the native tools. CI runs these same targets — if CI
# invokes something different, local green stops meaning anything.
#
# There is no build step and there are no JS dependencies: js/ ships as-is.

PORT ?= 5173

.PHONY: test lint fmt fmt-check check check-icons ci dev clean

## test — the geometry, catalog and share-link gates
test:
	node --test test/*.test.js

## lint — syntax check every shipped module, then formatting
lint: fmt-check
	@for f in js/*.js test/*.js; do node --check "$$f" || exit 1; done
	@echo "lint ok"

## fmt-check — prettier if it is on PATH, otherwise a loud skip (never a silent pass)
fmt-check:
	@if command -v prettier >/dev/null 2>&1; then \
		prettier --check 'js/**/*.js' 'test/**/*.js' 'css/*.css' index.html; \
	else \
		echo "SKIP: prettier not installed — formatting NOT checked"; \
	fi

fmt:
	@if command -v prettier >/dev/null 2>&1; then \
		prettier --write 'js/**/*.js' 'test/**/*.js' 'css/*.css' index.html; \
	else \
		echo "SKIP: prettier not installed"; \
	fi

## check-icons — probe the curated icon slugs against the live CDNs.
## NOT in `make check`: it needs network, and a flaky gate is worse than none.
check-icons:
	node scripts/check-icons.mjs

## check / ci — the gate
check: lint test
ci: check

## dev — serve the app; es modules need http, file:// will not do
dev:
	@echo "serving http://localhost:$(PORT)/"
	@python3 -m http.server $(PORT) --bind 127.0.0.1

clean:
	@rm -rf .cache

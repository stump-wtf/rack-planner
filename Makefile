# Thin wrappers over the native tools. CI runs these same targets — if CI
# invokes something different, local green stops meaning anything.
#
# There is no build step and there are no JS dependencies: js/ ships as-is.

PORT ?= 5173

# The one prettier the repo formats against. CI does not get to pick its own:
# newer prettiers rewrap multi-value CSS declarations (background-image), so an
# unpinned local run happily reformats what the pinned CI run then rejects.
PRETTIER_VERSION ?= 3.3.3
PRETTIER_FILES := 'js/**/*.js' 'test/**/*.js' 'css/*.css' index.html

# 1 where an unobtainable prettier must fail instead of skip. CI sets it, so
# the skip below can never become CI's idea of green.
PRETTIER_STRICT ?= 0

.PHONY: test lint fmt fmt-check check check-icons ci dev clean

## test — the geometry, catalog and share-link gates
test:
	node --test test/*.test.js

## lint — syntax check every shipped module, then formatting
lint: fmt-check
	@for f in js/*.js test/*.js; do node --check "$$f" || exit 1; done
	@echo "lint ok"

## $(call prettier,<mode>,<past tense>) — run the pinned prettier. A prettier
## on PATH is the fast path, but only when its version matches the pin;
## otherwise npx fetches the pinned one, which keeps a clean checkout working
## with no npm install (the repo ships zero JS dependencies, deliberately).
## When neither is obtainable it is a loud skip, never a silent pass.
define prettier
	@pin='$(PRETTIER_VERSION)'; \
	if command -v prettier >/dev/null 2>&1; then \
		have=$$(prettier --version 2>/dev/null); \
		if [ "$$have" = "$$pin" ]; then \
			exec prettier $(1) $(PRETTIER_FILES); \
		fi; \
		echo "NOTE: prettier $$have on PATH, repo pins $$pin — using npx prettier@$$pin"; \
	fi; \
	if command -v npx >/dev/null 2>&1 && npx --yes prettier@$$pin --version >/dev/null 2>&1; then \
		exec npx --yes prettier@$$pin $(1) $(PRETTIER_FILES); \
	fi; \
	echo "SKIP: prettier $$pin unavailable (not on PATH, npx could not fetch it) — formatting NOT $(2)"; \
	[ "$(PRETTIER_STRICT)" != "1" ] || { echo "PRETTIER_STRICT=1: refusing to pass without it"; exit 1; }
endef

## fmt-check — the pinned prettier, or a loud skip (never a silent pass)
fmt-check:
	$(call prettier,--check,checked)

fmt:
	$(call prettier,--write,written)

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

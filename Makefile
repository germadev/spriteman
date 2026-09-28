# Makefile — Build, Test, and Automation for Spritemotion

.PHONY: all install test typecheck build up clean

all: build

## install: Install all project dependencies (npm packages and checks for wasm-pack)
install:
	@export PATH="$(HOME)/.cargo/bin:$$PATH"; \
	if ! command -v rustup >/dev/null 2>&1; then \
		echo "rustup not found. Installing it in $(HOME)/.cargo/bin (no admin permissions required)..."; \
		curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path; \
		export PATH="$(HOME)/.cargo/bin:$$PATH"; \
	fi; \
	if ! command -v wasm-pack >/dev/null 2>&1; then \
		echo "wasm-pack not found. Installing via cargo..."; \
		cargo install wasm-pack; \
	fi; \
	target_libdir="$$(rustc --print target-libdir --target wasm32-unknown-unknown 2>/dev/null)"; \
	if ! test -d "$$target_libdir"; then \
		if command -v rustup >/dev/null 2>&1; then \
			rustup target add wasm32-unknown-unknown; \
		else \
			echo "Missing Rust target wasm32-unknown-unknown." >&2; \
			echo "Install rustup, then run: rustup target add wasm32-unknown-unknown" >&2; \
			exit 1; \
		fi; \
	fi
	npm install

## typecheck: Type-check the TypeScript sources
typecheck:
	npx tsc --noEmit

## test: Run the frontend type check and unit tests, then the Rust suite
test:
	npx tsc --noEmit
	npx vitest run
	cargo test

## build: Compile native Rust release library, WebAssembly package, and frontend bundle
build:
	cargo build --release
	wasm-pack build engine --target web --out-dir ../src/wasm/pkg
	npx vite build

## up: Install dependencies, build/watch WASM, and start Vite with HMR
up: install
	@set -e; \
	export PATH="$(HOME)/.cargo/bin:$$PATH"; \
	watch_marker=$$(mktemp "$${TMPDIR:-/tmp}/spritemotion-wasm.XXXXXX"); \
	wasm-pack build engine --dev --target web --out-dir ../src/wasm/pkg; \
	touch "$$watch_marker"; \
	watch_wasm() { \
		while true; do \
			changed=$$(find engine -type f \( -name '*.rs' -o -name 'Cargo.toml' -o -name 'Cargo.lock' \) -newer "$$watch_marker" -print -quit); \
			if test -z "$$changed"; then \
				changed=$$(find Cargo.toml Cargo.lock -newer "$$watch_marker" -print -quit 2>/dev/null || true); \
			fi; \
			if test -n "$$changed"; then \
				echo "Rust change detected; rebuilding WASM..."; \
				wasm-pack build engine --dev --target web --out-dir ../src/wasm/pkg; \
				touch "$$watch_marker"; \
			fi; \
			sleep 0.5; \
		done; \
	}; \
	watch_wasm & \
	wasm_pid=$$!; \
	trap 'kill $$wasm_pid 2>/dev/null || true; rm -f "$$watch_marker"' INT TERM EXIT; \
	npx vite --port 3000 & \
	vite_pid=$$!; \
	trap 'kill $$wasm_pid $$vite_pid 2>/dev/null || true' INT TERM EXIT; \
	wait $$vite_pid

## clean: Remove build artifacts and temporary files
clean:
	cargo clean
	rm -rf dist src/wasm/pkg

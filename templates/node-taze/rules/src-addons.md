---
paths:
  - "src/addons/**/*"
---

# src/addons

## 책임

패키지 파일 쓰기 전/후에 실행되는 후처리 애드온을 제공한다.

## 연관관계

```
commands/index.ts --호출--> addons/builtinAddons (postprocess)
io/writePackageJSON --호출--> addons/builtinAddons (beforeWrite)
io/writePackageYAML --호출--> addons/builtinAddons (beforeWrite)
addons/index.ts --export--> builtinAddons = [addonVSCode, ...]
```

---

## 핵심 패턴

### 1. 네이밍 규칙

- 애드온 객체 이름: `addon{Name}` (예: `addonVSCode`)
- 내장 목록: `builtinAddons` 배열로 export

```ts
// src/addons/vscode.ts
export const addonVSCode: Addon = { beforeWrite(pkg) { /* ... */ } }

// src/addons/index.ts
import { addonVSCode } from './vscode'
export const builtinAddons = [addonVSCode]
```

### 2. 애드온 타입

`Addon` 타입은 `../types`에서 `import type`으로 가져온다.

```ts
import type { Addon } from '../types'

export const addonVSCode: Addon = {
  beforeWrite(pkg) { /* ... */ },
}
```

### 3. 패키지 필드 접근

`pkg.raw` 및 하위 필드는 optional chaining, falsy면 조기 반환.

```ts
beforeWrite(pkg) {
  if (!pkg.raw?.engines?.vscode) return

  const version =
    pkg.raw.dependencies?.['@types/vscode'] ||
    pkg.raw.devDependencies?.['@types/vscode'] ||
    pkg.raw.peerDependencies?.['@types/vscode'] ||
    ''
}
```

### 4. 버전 문자열 처리

- `dependencies` → `devDependencies` → `peerDependencies` 순으로 조회
- `workspace:`, `catalog:` 등 프로토콜 포함 버전은 건너뜀
- `semver.minVersion` 결과가 없으면 조기 반환

```ts
if (!version || version.includes(':')) return

const minEngineVersion = semver.minVersion(pkg.raw.engines.vscode)
const minVersion = semver.minVersion(version)
if (!minEngineVersion || !minVersion) return
```

### 5. semver 비교 후 엔진 필드 업데이트

```ts
if (semver.gt(minVersion, minEngineVersion)) {
  // eslint-disable-next-line no-console
  console.log(`[taze addon] Updated VS Code engine field to ${version}`)
  pkg.raw.engines.vscode = /[>^<:~]/.test(version) ? version : `^${version}`
}
```

- 고정 버전 문자열이면 `^` prefix 추가
- 범위 연산자 포함 시 그대로 사용
- `console.log` 사용 시 `// eslint-disable-next-line no-console` 주석 추가

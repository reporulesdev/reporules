---
paths:
  - "src/utils/**/*"
---

# src/utils

## 책임

레지스트리 조회, 버전 계산, 정렬, 설정 로딩 등 공통 유틸 함수를 제공한다.

## 연관관계

```
io/ --> utils/npm (버전 조회)
api/ --> utils/versions (버전 범위 계산)
commands/ --> utils/sort, utils/diff (정렬, diff 타입)
utils/npm.ts --> utils/config.ts (npm 설정)
```

---

## 핵심 패턴

### 1. 타입 전용 import + `node:` 프리픽스

```ts
import type { CheckOptions } from '../types'
import process from 'node:process'
```

### 2. 최상위 `export function` / `export const`

클래스 없이 순수 함수/상수로 제공.

```ts
export function getPackageMode(pkgName: string, options: CheckOptions) {
  if (!options.packageMode) return undefined
  for (const name of Object.keys(options.packageMode)) {
    if (filterToRegex(name).test(pkgName)) return options.packageMode[name]
  }
}
export const DiffMap = { error: -1, major: 0, minor: 1, patch: 2 }
```

### 3. 조건문 스타일

단일 문장: 중괄호 생략, 여러 줄: 중괄호 사용.

```ts
if (!options.packageMode)
  return undefined
```

### 4. 화살표 함수: 표현식 형태

```ts
return versions.filter(version => !deprecated[version])
```

### 5. 모듈 레벨 캐시 + 동적 import

```ts
// 캐시: 비용 큰 비동기 초기화는 모듈 스코프 Promise 캐시
let _cache: Promise<Recordable> | undefined
export function getNpmConfig() { if (!_cache) _cache = _getNpmConfig(); return _cache }

// 동적 import: 런타임 의존성은 await import()로 지연 로딩
const { default: NpmCliConfig } = await import('@npmcli/config')
```

### 6. 네트워크 호출 타임아웃

```ts
const TIMEOUT = 5000
const data = await Promise.race([
  getVersions(spec, { force, fetch, throw: false, metadata: true }),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout requesting "${spec}"`)), TIMEOUT)),
]) as PackageVersionsInfoWithMetadata
```

### 7. 맵/레코드 변환 + 타입 보강

```ts
// 레코드 변환: Object.entries + Object.fromEntries 패턴
Object.fromEntries(
  Object.entries(packument.versions)
    .map(([v, meta]) => [v, !!meta.dist?.attestations?.provenance])
    .filter(([_, p]) => p),
)

// 타입 보강: .d.ts에서 declare module 사용
declare module '@npmcli/config' {
  export default class NpmcliConfig {
    load(): Promise<void>
    get flat(): Recordable
  }
}
```

---
paths:
  - "src/api/**/*"
---

# src/api

## 책임

패키지 의존성 체크의 핵심 오케스트레이션을 담당한다. commands와 io를 콜백으로 연결한다.

## 연관관계

```
commands/ --호출--> api/CheckPackages
api/CheckPackages --콜백--> commands/ (afterPackagesLoaded 등)
api/CheckPackages --호출--> io/loadPackage, io/resolvePackage
api/ --결과반환--> commands/ ({ packages })
```

---

## 핵심 패턴

### 1. 네이밍 규칙

공개 진입 함수: `PascalCase`, 내부 보조 함수: `camelCase`

```ts
export async function CheckPackages(options: CheckOptions, callbacks: CheckEventCallbacks = {}) {}
async function CheckSingleProject(pkg: PackageMeta, options: CheckOptions,
  filter: DependencyFilter = () => true, callbacks: CheckEventCallbacks = {}) {}
```

### 2. 콜백 인터페이스

모든 콜백은 선택적(`?`), `export interface`로 정의.

```ts
export interface CheckEventCallbacks {
  afterPackagesLoaded?: (pkgs: PackageMeta[]) => void
  beforePackageStart?: (pkg: PackageMeta) => void
  afterPackageEnd?: (pkg: PackageMeta) => void
  beforePackageWrite?: (pkg: PackageMeta) => boolean | Promise<boolean>
  afterPackagesEnd?: (pkgs: PackageMeta[]) => void
  afterPackageWrite?: (pkg: PackageMeta) => void
  onDependencyResolved?: DependencyResolvedCallback
}
```

### 3. 콜백 호출: Optional Chaining

```ts
callbacks.afterPackagesLoaded?.(packages)
callbacks.beforePackageStart?.(pkg)
```

### 4. boolean 콜백: `false`일 때만 스킵

```ts
const shouldWrite = await Promise.resolve(callbacks.beforePackageWrite?.(pkg))
if (shouldWrite !== false) {
  await writePackage(pkg, options)
  callbacks.afterPackageWrite?.(pkg)
}
```

### 5. 필터 기본값: 항상 `true` 반환

```ts
async function CheckSingleProject(
  pkg: PackageMeta,
  options: CheckOptions,
  filter: DependencyFilter = () => true,
) { await resolvePackage(pkg, options, filter, callbacks.onDependencyResolved) }
```

### 6. 프라이빗 패키지 필터링

```ts
const privatePackageNames = packages.filter(i => i.private).map(i => i.name).filter(i => i)
const filter = (dep: RawDep) => !privatePackageNames.includes(dep.name)
```

### 7. 캐시 조건부 로드/덤프

```ts
if (!options.force) await loadCache()
// ... 처리 ...
await dumpCache()
```

### 8. 결과 반환, 타입 import

```ts
return { packages }

import type { CheckOptions, DependencyFilter, PackageMeta, RawDep } from '../types'
```

---
paths:
  - "src/io/**/*"
---

# src/io

## 책임

패키지 파일 포맷별(JSON/YAML/pnpm/Yarn/Bun) 로드와 쓰기를 담당한다.

## 연관관계

```
api/ --> io/loadPackage (읽기)
commands/ --> io/writePackage (쓰기)
io/loadPackage --> loadPackageJSON | loadPackageYAML | loadPnpmWorkspace | ...
io/writePackage --> writePackageJSON | writePackageYAML | ...
io/dependencies.ts <-- 모든 로더/라이터
```

---

## 핵심 패턴

### 1. 로더 시그니처

```ts
export async function loadX(relative: string, options: CommonOptions,
  shouldUpdate: (name: string) => boolean): Promise<Meta[]> {
  const filepath = resolve(options.cwd ?? '', relative)
}
```

### 2. 라이터: 단일 진입점에서 타입별 분기

```ts
export async function writePackage(pkg: PackageMeta, options: CommonOptions) {
  switch (pkg.type) {
    case 'package.json': return writePackageJSON(pkg, options)
    case 'package.yaml': return writePackageYAML(pkg, options)
    case 'pnpm-workspace.yaml': return writePnpmWorkspace(pkg, options)
    default: throw new Error(`Unsupported package type: ${pkg.type}`)
  }
}
```

### 3. 의존성 파싱/덤프

```ts
deps.push(...parseDependencies(raw, key, shouldUpdate))
setByPath(pkg.raw, key, dumpDependencies(pkg.resolved, key))  // dependencies.ts 사용
```

### 4. packageManager 필드 특별 처리

```ts
// 로드: '+' 해시 제거, '^' prefix 추가
deps.push(parseDependency(name, `^${version.split('+')[0]}`, 'packageManager', shouldUpdate))
// 저장: '^' 제거
pkg.raw.packageManager = `${value[0]}@${value[1].replace('^', '')}`
```

### 5. 파일 포맷 유지 + addons

기존 파일 읽어 `detectIndent`로 들여쓰기 유지. 변경 시 addons 실행 후 쓰기:
```ts
if (changed) {
  for (const addon of (options.addons || builtinAddons))
    await addon.beforeWrite?.(pkg, options)
  await writeJSON(pkg.filepath, pkg.raw || {})
}
```

### 6. 로더 진입점: 파일명으로 타입 판별

```ts
if (relative.endsWith('pnpm-workspace.yaml')) return loadPnpmWorkspace(...)
if (relative.endsWith('.yarnrc.yml')) return loadYarnWorkspace(...)
if (relative.endsWith('package.yaml')) return loadPackageYAML(...)
return loadPackageJSON(...)
```

### 7. PackageMeta 공통 필드 + 재귀 탐색

- 같은 디렉터리에 `package.yaml`과 `package.json` 둘 다 있으면 `package.yaml` 우선
- 워크스페이스 루트 메타 파일은 목록 앞에 `unshift`

```ts
function isDepFieldEnabled(key: DepType, options: CommonOptions): boolean {
  if (options.depFields?.[key] === false) return false
  if (key === 'peerDependencies') return !!options.peer
  return true
}
```
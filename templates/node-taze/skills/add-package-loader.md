# add-package-loader

새 패키지 파일 포맷(로더/라이터)을 추가하는 절차.

---

## 전제 조건

- `src/types.ts`의 `PackageMeta`, `CommonOptions`, `RawDep` 타입을 이해해야 한다.
- `src/io/dependencies.ts`의 `parseDependencies`, `dumpDependencies`를 이해해야 한다.

---

## 단계별 작업 순서

### 1단계: 타입 추가 (src/types.ts)

```ts
export interface MyFormatMeta extends PackageMetaBase { type: 'my-format'; raw: MyFormatRaw | null }
```

### 2단계: 로더 구현 (src/io/myFormat.ts)

```ts
export async function loadMyFormat(
  relative: string,
  options: CommonOptions,
  shouldUpdate: (name: string) => boolean,
): Promise<MyFormatMeta[]> {
  const filepath = resolve(options.cwd ?? '', relative)
  const raw = await readMyFormat(filepath)
  if (!raw) return []

  const deps: RawDep[] = []
  for (const key of allDepsFields) {
    if (!isDepFieldEnabled(key, options)) continue
    deps.push(...parseDependencies(raw, key, shouldUpdate))
  }

  // PackageMeta 공통 필드 세트 유지
  return [{ name: raw.name ?? '', private: !!raw.private, version: raw.version ?? '',
    type: 'my-format', relative, filepath, raw, deps, resolved: [] }]
}
```

### 3단계: 라이터 구현 (src/io/myFormat.ts)

```ts
export async function writeMyFormat(pkg: MyFormatMeta, options: CommonOptions) {
  if (pkg.type !== 'my-format') throw new Error('Package type is not supported')
  let changed = false
  const raw = { ...pkg.raw }

  for (const key of allDepsFields) {
    if (!isDepFieldEnabled(key, options)) continue
    const updated = dumpDependencies(pkg.resolved, key)
    if (Object.keys(updated).length) { setByPath(raw, key, updated); changed = true }
  }

  // addons: 쓰기 직전에만 실행, 변경 없으면 파일 미수정
  if (changed) {
    for (const addon of (options.addons || builtinAddons))
      await addon.beforeWrite?.(pkg, options)
    await writeMyFormatFile(pkg.filepath, raw)
  }
}
```

### 4단계: loadPackage / writePackage 분기에 추가 (src/io/package.ts)

```ts
// loadPackage
if (relative.endsWith('my-format.ext')) return loadMyFormat(relative, options, shouldUpdate)

// writePackage switch
case 'my-format': return writeMyFormat(pkg, options)
```

### 5단계: 재귀 탐색 + 검증

```ts
// 재귀 탐색 glob 패턴 추가
const myFormatFiles = await glob('**/my-format.ext', { ignore: [...] })
for (const f of myFormatFiles) packagesNames.push(f)
```

검증 항목:
- `taze check` 실행 후 의존성 파싱 확인
- `write: true`로 파일 수정 및 들여쓰기/포맷 유지 확인
- 변경 없을 때 파일 미수정 확인

---

## 주의사항

- 로더 인자: `CommonOptions`와 `shouldUpdate` 필수
- `PackageMeta` 공통 필드(`name`, `private`, `version`, `type`, `relative`, `filepath`, `raw`, `deps`, `resolved: []`) 모두 포함
- 변경 없으면 파일 수정하지 않는다 (`if (changed)`)
- `addons.beforeWrite`는 파일 쓰기 직전에만 호출한다

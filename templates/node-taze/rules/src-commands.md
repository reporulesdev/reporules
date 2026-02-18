---
paths:
  - "src/commands/check/**/*"
---

# src/commands

## 책임

CLI 체크 명령의 진입, 렌더링, 인터랙티브 UI, 설치/쓰기 플로우를 구현한다.

## 연관관계

```
index.ts / checkGlobal.ts
  --> api/CheckPackages (콜백으로 훅 등록)
  --> render.ts (renderPackages, renderChanges, outputErr)
  --> interactive.ts (promptInteractive)
  --> io/writePackage + addons/builtinAddons (쓰기 시)
```

---

## 핵심 패턴

### 1. 타입 사용

```ts
import type { CheckOptions, PackageMeta } from '../../types'

export async function check(options: CheckOptions) {
  let resolvePkgs: PackageMeta[] = []
}
```

### 2. 렌더링 책임 분리

렌더링은 `render.ts`에 집중, 엔트리는 렌더 함수만 호출.

```ts
const { lines, errLines } = renderPackages(resolvePkgs, options)
console.log(lines.join('\n'))
if (errLines.length) outputErr(errLines)
```

### 3. 인터랙티브 모드

```ts
if (options.interactive)
  resolvePkgs = await promptInteractive(resolvePkgs, options)
```

### 4. 프로그레스 바

`loglevel === 'silent'`이면 생성 안 함.

```ts
const bars = options.loglevel === 'silent' ? null : createMultiProgressBar()
const depBar = bars?.create(1, 0)
await CheckPackages(options, {
  beforePackageStart(pkg) { depBar?.start(pkg.deps.length, 0) },
  onDependencyResolved(_pkgName, _name, progress) { depBar?.update(progress) },
  afterPackageEnd() { depBar?.stop() },
})
bars?.stop()
```

### 5. 변경 여부 판단 및 종료 코드

```ts
const hasChanges = resolvePkgs.some(i => i.resolved.some(j => j.update))
if (!hasChanges) return exitCode
if (options.failOnOutdated) exitCode = 1
```

### 6. 쓰기 및 설치

```ts
if (options.write) {
  for (const pkg of resolvePkgs) {
    for (const addon of (options.addons || builtinAddons))
      await addon.postprocess?.(pkg, options)
    await writePackage(pkg, options)
  }
}
if (options.install) await run(parseNi, [])
```

### 7. 인터랙티브 렌더러 인터페이스

```ts
interface InteractiveRenderer {
  render: () => void
  // onKey: true → 재렌더, InteractiveRenderer → 교체, false/void → 렌더 없음
  onKey: (key: TerminalKey) => boolean | InteractiveRenderer | void
}
```

### 8. 글로벌 패키지 패턴

exec으로 글로벌 목록 조회 후 아래 필드 세트 유지: `{ agent, type: 'global', private: true, resolved: [], raw: null, version: '', filepath: '', relative: '', deps }`
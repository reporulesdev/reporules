# add-command

새 CLI 체크 명령(로컬 또는 글로벌)을 추가하는 절차.

---

## 전제 조건

- `src/types.ts`에 필요한 옵션 타입이 정의되어 있어야 한다.
- `src/api/`의 `CheckPackages` 콜백 인터페이스를 이해해야 한다.

---

## 단계별 작업 순서

### 1단계: 타입 추가 (src/types.ts)

```ts
export interface MyCommandOptions extends CheckOptions {
  mySpecificFlag?: boolean
}
```

### 2단계: 엔트리 파일 생성 (src/commands/myCommand/index.ts)

```ts
import type { MyCommandOptions, PackageMeta } from '../../types'

export async function myCommand(options: MyCommandOptions) {
  let resolvePkgs: PackageMeta[] = []
  let exitCode = 0

  // 1. 프로그레스 바
  const bars = options.loglevel === 'silent' ? null : createMultiProgressBar()
  const depBar = bars?.create(1, 0)

  // 2. 패키지 체크
  await CheckPackages(options, {
    beforePackageStart(pkg) { depBar?.start(pkg.deps.length, 0) },
    afterPackageEnd(pkg) { depBar?.stop(); resolvePkgs.push(pkg) },
    beforePackageWrite() { return false },  // 자동 쓰기 비활성화
    onDependencyResolved(_pkgName, _name, progress) { depBar?.update(progress) },
  })
  bars?.stop()

  // 3. 인터랙티브 모드
  if (options.interactive)
    resolvePkgs = await promptInteractive(resolvePkgs, options)

  // 4. 렌더링
  const { lines, errLines } = renderPackages(resolvePkgs, options)
  console.log(lines.join('\n'))
  if (errLines.length) outputErr(errLines)

  // 5. 변경 여부 판단
  const hasChanges = resolvePkgs.some(i => i.resolved.some(j => j.update))
  if (!hasChanges) return exitCode
  if (options.failOnOutdated) exitCode = 1

  // 6. 쓰기/설치
  if (options.write) {
    for (const pkg of resolvePkgs) {
      for (const addon of (options.addons || builtinAddons))
        await addon.postprocess?.(pkg, options)
      await writePackage(pkg, options)
    }
  }
  if (options.install) await run(parseNi, [])

  return exitCode
}
```

### 3단계: render.ts 작성

기존 `check/render.ts`의 `renderPackages`, `renderChanges`, `outputErr`를 재사용하거나 import한다.

### 4단계: CLI 진입점에 명령 등록

```ts
cli.command('my-command', 'description')
  .action((options) => myCommand(options))
```

### 5단계: 검증

- `loglevel: 'silent'` - 바 없이 동작 확인
- `write: true` - 파일 수정 확인
- `failOnOutdated: true` - 종료 코드 1 확인
- `interactive: true` - 인터랙티브 모드 확인

---

## 주의사항

- 렌더링 로직은 `render.ts`에만 배치, 엔트리는 렌더 함수 호출만
- `loglevel === 'silent'`이면 프로그레스 바 생성하지 않음
- `beforePackageWrite`에서 `false` 반환해야 자동 쓰기 비활성화
- 변경 사항 없으면 쓰기/설치 단계 건너뜀

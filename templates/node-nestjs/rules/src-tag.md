---
paths:
  - "src/tag/**/*"
---

# src/tag Guide

## 책임
태그 목록을 DB에서 조회하여 반환하는 단순 읽기 전용 엔드포인트를 제공한다.

## 연관관계
```
HTTP Request (GET /tags)
  → TagController
    → TagService (Repository.find())
      → TagEntity
  → Response: TagEntity[]
```

## 필수 파일 구조
`tag.module.ts`, `tag.controller.ts`, `tag.service.ts`, `tag.entity.ts`, `tag.controller.spec.ts`

## Controller 패턴

```ts
@ApiTags('tags')
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  async findAll(): Promise<TagEntity[]> {
    return this.tagService.findAll();
  }
}
```
- `@ApiTags`, `@ApiBearerAuth` 사용, 비즈니스 로직은 Service에 위임

## Service 패턴

```ts
@Injectable()
export class TagService {
  constructor(
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
  ) {}

  async findAll(): Promise<TagEntity[]> {
    return this.tagRepository.find();
  }
}
```
- `Repository.find()`로 단순 전체 조회, `async/await` 사용

## Entity 패턴

```ts
@Entity('tag')
export class TagEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column() tag: string;
}
```
- `@Entity('tag')`로 테이블명 명시, `@PrimaryGeneratedColumn()`으로 기본 키

## Module 패턴

```ts
@Module({
  imports: [TypeOrmModule.forFeature([TagEntity]), UserModule],
  providers: [TagService],
  controllers: [TagController],
  exports: [],
})
export class TagModule {}
```
- 외부에 노출할 Provider 없으므로 `exports: []`

## Test 패턴

```ts
describe('TagController', () => {
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), TypeOrmModule.forFeature([TagEntity])],
      controllers: [TagController],
      providers: [TagService],
    }).compile();
    tagController = module.get<TagController>(TagController);
  });
});
```
- `Test.createTestingModule` + `module.get<Class>(Class)`로 인스턴스 획득

## Naming 규칙

- 파일명: `*.controller.ts`, `*.service.ts`, `*.entity.ts`, `*.module.ts`, `*.controller.spec.ts`
- 클래스명: PascalCase (`TagController`, `TagService`, `TagEntity`, `TagModule`)
- 메서드명: 동사 기반 camelCase (`findAll`, `create` 등)

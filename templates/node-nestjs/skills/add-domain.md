# Skill: 새 도메인 모듈 추가

새로운 도메인(예: `post`, `category`)을 NestJS 모듈로 추가하는 전체 흐름.
참고 rules: `rules/src-user.md`, `rules/src-article.md`

---

## 단계별 파일 생성 순서

### 1. Entity (`src/{domain}/{domain}.entity.ts`)

```ts
@Entity('{domain}')
export class {Domain}Entity {
  @PrimaryGeneratedColumn() id: number;
  @Column() title: string;
  @Column({ default: '' }) description: string;
  @BeforeInsert() async beforeInsertHook() { /* 슬러그 생성, 해시 등 */ }
}
```

### 2. DTO (`src/{domain}/dto/`)

```ts
// create-{domain}.dto.ts
export class Create{Domain}Dto {
  @IsNotEmpty() readonly title: string;
  @IsNotEmpty() readonly description: string;
}
// update-{domain}.dto.ts
export class Update{Domain}Dto { readonly title?: string; readonly description?: string; }
// index.ts - barrel export
export { Create{Domain}Dto } from './create-{domain}.dto';
export { Update{Domain}Dto } from './update-{domain}.dto';
```

### 3. Interface (`src/{domain}/{domain}.interface.ts`)

```ts
export interface {Domain}Data { title: string; description: string; createdAt?: Date; }
export interface {Domain}RO { {domain}: {Domain}Data; }
export interface {Domains}RO { {domains}: {Domain}Data[]; {domains}Count: number; }  // 리스트: 배열 + Count
```

### 4. Service (`src/{domain}/{domain}.service.ts`)

```ts
@Injectable()
export class {Domain}Service {
  constructor(@InjectRepository({Domain}Entity) private readonly repo: Repository<{Domain}Entity>) {}

  async create(dto: Create{Domain}Dto): Promise<{Domain}RO> {
    const entity = Object.assign(new {Domain}Entity(), dto);
    const errors = await validate(entity);
    if (errors.length > 0)
      throw new HttpException({ message: 'Validation failed' }, HttpStatus.BAD_REQUEST);
    return { {domain}: await this.repo.save(entity) };
  }

  async findAll(): Promise<{Domains}RO> {
    const [items, count] = await this.repo.findAndCount();
    return { {domains}: items, {domains}Count: count };
  }
}
```

### 5. Controller (`src/{domain}/{domain}.controller.ts`)

```ts
@ApiBearerAuth() @ApiTags('{domains}') @Controller('{domains}')
export class {Domain}Controller {
  constructor(private readonly {domain}Service: {Domain}Service) {}

  @Get()
  async findAll(): Promise<{Domains}RO> { return this.{domain}Service.findAll(); }

  @UsePipes(new ValidationPipe())
  @Post()
  async create(@User('id') userId: number, @Body('{domain}') dto: Create{Domain}Dto) {
    return this.{domain}Service.create(dto);
  }
}
```

### 6. Module (`src/{domain}/{domain}.module.ts`)

```ts
@Module({
  imports: [TypeOrmModule.forFeature([{Domain}Entity]), UserModule],
  providers: [{Domain}Service],
  controllers: [{Domain}Controller],
  exports: [{Domain}Service],
})
export class {Domain}Module {}
```

### 7. AppModule에 등록
`src/app.module.ts`의 `@Module({ imports: [..., {Domain}Module] })` 에 추가

# Skill: 서브 리소스(댓글 등) 추가

기존 도메인에 종속된 서브 리소스(예: Article의 Comment)를 추가하는 흐름.
참고 rules: `rules/src-article.md`

패턴 개요:
```
ArticleEntity (부모) @OneToMany comments
  → CommentEntity @ManyToOne article → ArticleEntity
```

## 단계별 파일 생성 순서

### 1. 서브 리소스 Entity (`src/{domain}/{subDomain}.entity.ts`)

```ts
@Entity()
export class {SubDomain}Entity {
  @PrimaryGeneratedColumn() id: number;
  @Column() body: string;
  @ManyToOne(() => {Domain}Entity, entity => entity.{subDomains})
  {domain}: {Domain}Entity;
}
```

### 2. 부모 Entity에 관계 필드 추가

```ts
@Entity('{domain}')
export class {Domain}Entity {
  // 기존 필드들...
  @OneToMany(() => {SubDomain}Entity, sub => sub.{domain}, { eager: true })
  {subDomains}: {SubDomain}Entity[];
}
```
- `{ eager: true }`: 부모 조회 시 서브 리소스 자동 로드

### 3. DTO + Interface RO

```ts
// dto/create-{subDomain}.dto.ts
export class Create{SubDomain}Dto { readonly body: string; }
// dto/index.ts에 barrel export 추가
// {domain}.interface.ts에 추가
export interface {SubDomains}RO { {subDomains}: {SubDomain}Entity[]; }
```

### 4. Service에 서브 리소스 메서드 추가

```ts
@Injectable()
export class {Domain}Service {
  constructor(
    @InjectRepository({Domain}Entity) private readonly {domain}Repo: Repository<{Domain}Entity>,
    @InjectRepository({SubDomain}Entity) private readonly {subDomain}Repo: Repository<{SubDomain}Entity>,
  ) {}

  async addSubResource(slug: string, dto: Create{SubDomain}Dto): Promise<{SubDomain}Entity> {
    const parent = await this.{domain}Repo.findOne({ slug });
    return this.{subDomain}Repo.save(Object.assign(new {SubDomain}Entity(), { body: dto.body, {domain}: parent }));
  }

  async getSubResources(slug: string): Promise<{SubDomains}RO> {
    const parent = await this.{domain}Repo.findOne({ slug });
    return { {subDomains}: parent.{subDomains} };
  }

  async deleteSubResource(id: number): Promise<void> { await this.{subDomain}Repo.delete({ id }); }
}
```

### 6. Controller에 엔드포인트 추가

```ts
@Get(':slug/comments')
async getComments(@Param('slug') slug: string): Promise<{SubDomains}RO> {
  return this.{domain}Service.getSubResources(slug);
}
@Post(':slug/comments')
async addComment(@Param('slug') slug: string, @Body('{subDomain}') dto: Create{SubDomain}Dto) {
  return this.{domain}Service.addSubResource(slug, dto);
}
@Delete(':slug/comments/:id')
async deleteComment(@Param('id') id: number): Promise<void> {
  return this.{domain}Service.deleteSubResource(id);
}
```

### 7. Module에 Entity 등록
```ts
@Module({
  imports: [TypeOrmModule.forFeature([{Domain}Entity, {SubDomain}Entity])],
  providers: [{Domain}Service], controllers: [{Domain}Controller],
})
export class {Domain}Module {}
```

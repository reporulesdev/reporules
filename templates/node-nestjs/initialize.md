# NestJS RealWorld - Initialize Guide

## 폴더 트리 구조

```
src/
  {domain}/
    {domain}.module.ts        # 모듈 조립
    {domain}.controller.ts    # REST API 진입점
    {domain}.service.ts       # 비즈니스 로직, 검증, 예외
    {domain}.entity.ts        # TypeORM 엔티티
    {domain}.interface.ts     # 응답 모델 (RO)
    dto/
      create-{domain}.dto.ts
      update-{domain}.dto.ts
      index.ts
  shared/
    pipes/validation.pipe.ts  # 공통 ValidationPipe
    base.controller.ts        # JWT 헬퍼
  app.module.ts
```

## 새 도메인 추가 시 생성 순서

1. `{domain}.entity.ts` - DB 테이블 정의
2. `dto/create-{domain}.dto.ts` - 입력 계약
3. `{domain}.interface.ts` - 응답 구조(RO)
4. `{domain}.service.ts` - 비즈니스 로직
5. `{domain}.controller.ts` - HTTP 라우트
6. `{domain}.module.ts` - 모듈 조립
7. `app.module.ts` - AppModule에 등록

## 각 구획별 핵심 스니펫

**Entity**
```ts
@Entity('article')
export class ArticleEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column('simple-array') tagList: string[];
  @OneToMany(() => CommentEntity, c => c.article, { eager: true })
  comments: CommentEntity[];
}
```

**Service**
```ts
@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly repo: Repository<ArticleEntity>,
  ) {}
  async create(dto: CreateArticleDto): Promise<ArticleRO> {
    return { article: await this.repo.save(Object.assign(new ArticleEntity(), dto)) };
  }
}
```

**Controller**
```ts
@ApiBearerAuth() @ApiTags('articles') @Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}
  @Post()
  async create(@User('id') userId: number, @Body('article') dto: CreateArticleDto) {
    return this.articleService.create(dto);
  }
}
```

**Module**
```ts
@Module({
  imports: [TypeOrmModule.forFeature([ArticleEntity]), UserModule],
  providers: [ArticleService],
  controllers: [ArticleController],
  exports: [ArticleService],
})
export class ArticleModule {}
```

## 관련 파일 목록

| 파일 | 용도 |
|------|------|
| `rules/src-article.md` | 게시글/댓글/즐겨찾기 패턴 |
| `rules/src-user.md` | 인증/프로필 수정 패턴 |
| `rules/src-profile.md` | 팔로우/언팔로우 패턴 |
| `rules/src-tag.md` | 단순 조회 패턴 |
| `rules/src-shared.md` | ValidationPipe, BaseController |
| `skills/add-domain.md` | 새 도메인 모듈 전체 추가 흐름 |
| `skills/add-relation.md` | 팔로우/좋아요 관계 기능 추가 |
| `skills/add-subresource.md` | 댓글 등 서브 리소스 추가 |

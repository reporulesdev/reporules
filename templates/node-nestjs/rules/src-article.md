---
paths:
  - "src/article/**/*"
---

# src/article Guide

## 책임
게시글(Article)과 댓글(Comment), 즐겨찾기의 REST API, 비즈니스 로직, 엔티티를 제공한다.

## 연관관계
```
HTTP Request
  → ArticleController (@Body('article'), @User('id'))
    → ArticleService (QueryBuilder, 관계 로직)
      → articleRepository / commentRepository
        → ArticleEntity (@OneToMany comments) / CommentEntity (@ManyToOne article)
  → Response: { article } / { articles, articlesCount }
```

## 필수 파일 구조
`article.controller.ts`, `article.service.ts`, `article.entity.ts`, `comment.entity.ts`, `article.interface.ts`, `dto/`

## Controller 패턴

```ts
@ApiBearerAuth() @ApiTags('articles') @Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  async findAll(@Query() query): Promise<ArticlesRO> {
    return this.articleService.findAll(query);
  }
  @Post()
  async create(@User('id') userId: number, @Body('article') dto: CreateArticleDto) {
    return this.articleService.create(userId, dto);
  }
}
```
- `@Body('article')`로 요청 본문 래핑 키 지정
- 인증 정보는 `@User('id')` 커스텀 데코레이터

## Service 패턴

```ts
@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(ArticleEntity) private readonly articleRepository: Repository<ArticleEntity>,
    @InjectRepository(CommentEntity) private readonly commentRepository: Repository<CommentEntity>,
  ) {}

  async findAll(query): Promise<ArticlesRO> {
    const qb = getRepository(ArticleEntity)
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author');
    const [items, count] = await qb.getManyAndCount();
    return { articles: items, articlesCount: count };
  }
}
```
- `createQueryBuilder()`로 동적 필터/페이징, 서브 리소스마다 별도 Repository

## Entity 패턴

```ts
@Entity('article')
export class ArticleEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column() slug: string;
  @Column('simple-array') tagList: string[];
  @OneToMany(() => CommentEntity, c => c.article, { eager: true }) comments: CommentEntity[];
}
@Entity()
export class CommentEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column() body: string;
  @ManyToOne(() => ArticleEntity, a => a.comments) article: ArticleEntity;
}
```

## DTO & Interface 패턴

```ts
export class CreateArticleDto { readonly title: string; readonly body: string; readonly tagList: string[]; }

export interface ArticleRO { article: ArticleEntity; }
export interface ArticlesRO { articles: ArticleEntity[]; articlesCount: number; }
export interface CommentsRO { comments: CommentEntity[]; }
```

## 규칙 요약

- Controller: 인증/요청 파싱/응답 포맷만, 로직은 Service에 위임
- Service: QueryBuilder 사용, `HttpException`으로 에러 처리
- Entity: DB 매핑만, 서브 리소스는 별도 엔티티 + `@OneToMany`/`@ManyToOne`
- 리스트 응답: `{entities}` 배열 + `{entities}Count` 패턴 유지

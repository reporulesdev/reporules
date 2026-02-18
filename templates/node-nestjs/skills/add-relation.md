# Skill: 팔로우/좋아요 등 관계 기능 추가

사용자 간 또는 사용자-도메인 간 관계(팔로우, 즐겨찾기, 좋아요)를 추가하는 흐름.
참고 rules: `rules/src-profile.md`, `rules/src-article.md`

---

## 패턴 개요

```
사용자 A (followerId)  --[FollowsEntity]--> 사용자 B (followingId)
사용자 A (userId)      --[FavoriteEntity]--> 게시글 (articleId)
```
관계는 별도 엔티티로 분리하고, CRUD 로직은 Service에 집중한다.

---

## 단계별 파일 생성 순서

### 1. 관계 Entity (`src/{domain}/{relation}.entity.ts`)

```ts
@Entity('{relations}')  // 예: 'follows', 'favorites'
export class {Relation}Entity {
  @PrimaryGeneratedColumn() id: number;
  @Column() {sourceId}: number;   // 예: followerId
  @Column() {targetId}: number;   // 예: followingId
}
```
- 검증/비즈니스 규칙은 Entity에 넣지 않음

### 2. Module에 등록 + AuthMiddleware 바인딩

```ts
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, {Relation}Entity])],
  providers: [{Domain}Service], controllers: [{Domain}Controller],
})
export class {Domain}Module implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(
      { path: '{route}/:id/follow', method: RequestMethod.ALL });
  }
}
```

### 3. Service에 관계 로직 추가

```ts
@Injectable()
export class {Domain}Service {
  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository({Relation}Entity) private readonly relationRepo: Repository<{Relation}Entity>,
  ) {}

  async addRelation(actorId: number, targetKey: string): Promise<{Domain}RO> {
    if (!actorId || !targetKey)
      throw new HttpException('Required params missing.', HttpStatus.BAD_REQUEST);
    const target = await this.userRepo.findOne({ username: targetKey });
    if (target.id === actorId)
      throw new HttpException('Cannot relate to yourself.', HttpStatus.BAD_REQUEST);
    const exists = await this.relationRepo.findOne({ {sourceId}: actorId, {targetId}: target.id });
    if (!exists)
      await this.relationRepo.save(
        Object.assign(new {Relation}Entity(), { {sourceId}: actorId, {targetId}: target.id }),
      );
    return { profile: { username: target.username, following: true } };
  }

  async removeRelation(actorId: number, targetKey: string): Promise<{Domain}RO> {
    const target = await this.userRepo.findOne({ username: targetKey });
    await this.relationRepo.delete({ {sourceId}: actorId, {targetId}: target.id });
    return { profile: { username: target.username, following: false } };
  }
}
```
- 자기 자신 관계 방지, 중복 삽입 방지 (`findOne` 후 없을 때만 `save`)
- 관계 제거는 `delete()`로 조건 지정

### 4. Controller에 엔드포인트 추가

```ts
@Post(':id/follow')
async follow(@User('id') userId: number, @Param('id') targetId: string): Promise<{Domain}RO> {
  return this.{domain}Service.addRelation(userId, targetId);
}
@Delete(':id/follow')
async unFollow(@User('id') userId: number, @Param('id') targetId: string): Promise<{Domain}RO> {
  return this.{domain}Service.removeRelation(userId, targetId);
}
```

### 5. Interface에 관계 상태 필드 추가
```ts
export interface {Domain}Data {
  username: string; bio: string; image?: string;
  following?: boolean;  // optional 필드로 추가
}
```

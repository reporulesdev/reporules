---
paths:
  - "src/profile/**/*"
---

# src/profile Guide

## 책임
사용자 프로필 조회와 팔로우/언팔로우 관계를 관리하며, 팔로우 상태가 포함된 프로필 응답을 제공한다.

## 연관관계
```
HTTP Request
  → ProfileController (@User('id'), @User('email'), @Param('username'))
    → ProfileService (팔로우 상태 조회, 중복/자기팔로우 검증)
      → userRepository / followsRepository
  → Response: { profile: ProfileData }
```

## 필수 파일 구조
`profile.module.ts`, `profile.controller.ts`, `profile.service.ts`, `follows.entity.ts`, `profile.interface.ts`

## Controller 패턴
```ts
@ApiBearerAuth() @ApiTags('profiles') @Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':username')
  async getProfile(@User('id') userId: number, @Param('username') username: string): Promise<ProfileRO> {
    return this.profileService.findProfile(userId, username);
  }
  @Post(':username/follow')
  async follow(@User('email') email: string, @Param('username') username: string): Promise<ProfileRO> {
    return this.profileService.follow(email, username);
  }
  @Delete(':username/follow')
  async unFollow(@User('id') userId: number, @Param('username') username: string): Promise<ProfileRO> {
    return this.profileService.unFollow(userId, username);
  }
}
```

## Service 패턴
```ts
@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(FollowsEntity) private readonly followsRepo: Repository<FollowsEntity>,
  ) {}

  async follow(followerEmail: string, targetUsername: string): Promise<ProfileRO> {
    if (!followerEmail || !targetUsername)
      throw new HttpException('Required params missing.', HttpStatus.BAD_REQUEST);
    const target = await this.userRepo.findOne({ username: targetUsername });
    const follower = await this.userRepo.findOne({ email: followerEmail });
    if (target.email === followerEmail)
      throw new HttpException('Cannot follow yourself.', HttpStatus.BAD_REQUEST);
    const exists = await this.followsRepo.findOne({ followerId: follower.id, followingId: target.id });
    if (!exists)
      await this.followsRepo.save(Object.assign(new FollowsEntity(), { followerId: follower.id, followingId: target.id }));
    return { profile: { username: target.username, bio: target.bio, image: target.image, following: true } };
  }

  async unFollow(followerId: number, targetUsername: string): Promise<ProfileRO> {
    const target = await this.userRepo.findOne({ username: targetUsername });
    await this.followsRepo.delete({ followerId, followingId: target.id });
    return { profile: { username: target.username, bio: target.bio, image: target.image, following: false } };
  }
}
```
- 자기팔로우 방지, 중복 삽입 방지 (`findOne` 후 없을 때만 `save`)

## Entity & Interface
```ts
@Entity('follows')
export class FollowsEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column() followerId: number;
  @Column() followingId: number;
}
export interface ProfileData { username: string; bio: string; image?: string; following?: boolean; }
export interface ProfileRO { profile: ProfileData; }
```

## Module 패턴
```ts
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, FollowsEntity]), UserModule],
  providers: [ProfileService], controllers: [ProfileController],
})
export class ProfileModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(
      { path: 'profiles/:username/follow', method: RequestMethod.ALL });
  }
}
```
- 인증 미들웨어는 `configure()`에서 특정 라우트에만 바인딩

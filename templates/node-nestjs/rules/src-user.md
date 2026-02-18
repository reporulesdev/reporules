---
paths:
  - "src/user/**/*"
---

# src/user Guide

## 책임
회원가입, 로그인, 프로필 수정 등 사용자 인증 및 계정 관리를 담당한다.

## 연관관계
```
HTTP Request
  → UserController (@Body('user'), @User('email') / @User('id'))
    → UserService (validate, buildRO)
      → userRepository → UserEntity (@BeforeInsert: 패스워드 해시 등)
  → Response: { user: UserData }
```

## 필수 파일 구조
`user.module.ts`, `user.controller.ts`, `user.service.ts`, `user.entity.ts`, `user.interface.ts`, `dto/`

## Controller 패턴

```ts
@ApiBearerAuth() @ApiTags('user') @Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('user')
  async findMe(@User('email') email: string): Promise<UserRO> {
    return this.userService.findByEmail(email);
  }
  @UsePipes(new ValidationPipe())
  @Post('users')
  async create(@Body('user') dto: CreateUserDto) { return this.userService.create(dto); }

  @Put('user')
  async update(@User('id') id: number, @Body('user') dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }
}
```
- `@Controller()` + 메서드 레벨 라우트 (`'user'`, `'users'`)
- 본문은 `@Body('user')` 래핑, 인증은 `@User('email')` / `@User('id')`

## Service 패턴

```ts
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserRO> {
    const entity = this.repo.create(dto as any);
    const errors = await validate(entity);
    if (errors.length > 0)
      throw new HttpException({ message: 'Input data validation failed' }, HttpStatus.BAD_REQUEST);
    return this.buildRO(await this.repo.save(entity));
  }

  private buildRO(entity: UserEntity): UserRO {
    return { user: { username: entity.username, email: entity.email, token: entity.token } };
  }
}
```
- `class-validator`의 `validate()`로 엔티티 직접 검증
- 항상 `buildRO()`로 `UserRO` 형태 반환

## Entity & DTO & Interface
```ts
@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column() email: string;
  @BeforeInsert() async beforeInsertHook() { /* 패스워드 해시 등 */ }
}
export class CreateUserDto {
  @IsNotEmpty() readonly username: string;
  @IsNotEmpty() readonly email: string;
  @IsNotEmpty() readonly password: string;
}
export class UpdateUserDto { readonly username?: string; readonly bio?: string; }
export interface UserData { username: string; email: string; token?: string; }
export interface UserRO { user: UserData; }
```
- 생성/로그인 DTO: `@IsNotEmpty()` 필수, Update DTO: 모든 필드 optional
- `dto/index.ts`에서 barrel export

## Module 패턴
```ts
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UserService], controllers: [UserController],
  exports: [UserService],  // ProfileModule 등에서 재사용
})
export class UserModule {}
```

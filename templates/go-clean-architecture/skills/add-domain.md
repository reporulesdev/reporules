# Skill: 새 도메인 전체 추가

새 도메인(예: `Comment`)을 처음부터 끝까지 추가하는 작업 흐름.

## Step 1: domain/comment.go — 참고: `rules/domain.md`

```go
const CollectionComment = "comments"

type Comment struct {
    ID     primitive.ObjectID `bson:"_id"`
    Body   string             `bson:"body" form:"body" binding:"required" json:"body"`
    TaskID primitive.ObjectID `bson:"taskID" json:"-"`
}

type CommentRepository interface {
    Create(c context.Context, comment *Comment) error
}
type CommentUsecase interface {
    Create(c context.Context, comment *Comment) error
}
```

## Step 2: repository/comment_repository.go — 참고: `rules/repository.md`

```go
type commentRepository struct{ database mongo.Database; collection string }

func NewCommentRepository(db mongo.Database, c string) domain.CommentRepository {
    return &commentRepository{database: db, collection: c}
}
func (cr *commentRepository) Create(c context.Context, comment *domain.Comment) error {
    col := cr.database.Collection(cr.collection)
    _, err := col.InsertOne(c, comment)
    return err
}
```

## Step 3: usecase/comment_usecase.go — 참고: `rules/usecase.md`

```go
type commentUsecase struct {
    commentRepository domain.CommentRepository
    contextTimeout    time.Duration
}
func NewCommentUsecase(r domain.CommentRepository, t time.Duration) domain.CommentUsecase {
    return &commentUsecase{commentRepository: r, contextTimeout: t}
}
func (u *commentUsecase) Create(c context.Context, comment *domain.Comment) error {
    ctx, cancel := context.WithTimeout(c, u.contextTimeout)
    defer cancel()
    return u.commentRepository.Create(ctx, comment)
}
```

## Step 4: api/controller/comment_controller.go — 참고: `rules/api.md`

```go
type CommentController struct{ CommentUsecase domain.CommentUsecase }

func (cc *CommentController) Create(c *gin.Context) {
    var comment domain.Comment
    if err := c.ShouldBind(&comment); err != nil {
        c.JSON(http.StatusBadRequest, domain.ErrorResponse{Message: err.Error()}); return
    }
    comment.ID = primitive.NewObjectID()
    if err := cc.CommentUsecase.Create(c, &comment); err != nil {
        c.JSON(http.StatusInternalServerError, domain.ErrorResponse{Message: err.Error()}); return
    }
    c.JSON(http.StatusOK, domain.SuccessResponse{Message: "Comment created successfully"})
}
```

## Step 5: api/route/comment_route.go — 참고: `rules/api.md`

```go
func NewCommentRouter(env *bootstrap.Env, timeout time.Duration, db mongo.Database, group *gin.RouterGroup) {
    cr := repository.NewCommentRepository(db, domain.CollectionComment)
    cc := &controller.CommentController{CommentUsecase: usecase.NewCommentUsecase(cr, timeout)}
    group.POST("/comment", cc.Create)
}
```

## Step 6: api/route/route.go 에 등록

```go
// 인증 필요: protectedRouter, 불필요: publicRouter
NewCommentRouter(env, timeout, db, protectedRouter)
```

## mocks 생성 (선택)

```bash
mockery --name=CommentRepository --dir=domain --output=domain/mocks
mockery --name=CommentUsecase    --dir=domain --output=domain/mocks
```

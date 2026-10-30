---
name: data-model
description: 提取代码仓库的核心数据结构（数据库表、ORM 模型、API 请求响应类型、领域类型、消息结构）及其关系，输出带引用的数据模型。分析数据结构时使用。
---

# 核心数据结构

仓库挂载在 `/repo`（只读）。输出必须符合 `dataModel` 结构，每个实体至少一个引用。

## 去哪里找

按优先级依次查看，找到足够信息就停：

1. **持久化 schema**：`prisma/schema.prisma`、`**/migrations/**`、`*.sql`、Drizzle/TypeORM/Sequelize/Mongoose 模型、SQLAlchemy/Django `models.py`、GORM struct、JPA `@Entity`。`kind` 填 `table`。
2. **校验 schema**：Zod / Yup / Joi / Pydantic / JSON Schema / OpenAPI components。`kind` 填 `schema`。
3. **接口类型**：API 层用到的 TypeScript `interface`/`type`、Go struct、Java DTO。`kind` 填 `type` 或 `class`。
4. **消息**：`.proto` 的 `message`、事件 payload 类型。`kind` 填 `message`。

如果有 TypeScript 语言服务工具（`get_symbols`、`get_type_hierarchy`、`get_references`），用它们确认类型定义与引用关系，比逐个读文件更省步数。

## 字段与关系

- `fields`：保留业务字段；`type` 写源码里的类型；`optional` 按 `?`、`nullable`、`Optional[...]` 判断。
- `relations`：外键、`@relation`、嵌套引用。`kind` 用 `has-one`、`has-many`、`belongs-to`、`many-to-many`、`references` 之一；继承与其他弱关联用 `references`。
- 同一个概念同时有表和类型时，以持久化 schema 为准，类型作为补充引用。

## 规则

- 引用路径相对仓库根，`line` 指向实体定义所在行。
- 只收录跨模块使用或持久化的结构；局部辅助类型不收录。实体超过 40 个时保留核心部分，在 `summary` 里说明。
- 不要执行仓库里的任何代码。

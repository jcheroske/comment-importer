import { JsonObject } from 'type-fest'

export type CommentAttributes = JsonObject & {
  postedDate: string
  firstName: string
  lastName: string
  title: string
  comment: string
  city: string
  submitterRepCityState: string
  country: string
}

export type DocumentAttributes = JsonObject & {
  commentStartDate: string
  commentEndDate: string
  objectId: string
}

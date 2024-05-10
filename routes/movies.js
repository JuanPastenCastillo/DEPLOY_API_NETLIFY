import express from "express"
import { allMoviesJSON } from "../data/movies.js"
import { formatResponse } from "../utils/formatResponse.js"
import { QUERY_KEYS, moviesQueryParams } from "../utils/moviesQueryParams.js"

export const router_movies = express.Router()

const ROUTES = {
  MOVIES: "/movies",
  HOME: "/"
}

router_movies.route("/").get((req, res) => {
  const { page, limit } = req.query
  const pageFormatted = page ? parseInt(page, 10) : 1
  const limitFormatted = limit ? parseInt(limit, 10) : 10

  const offset = page ? (pageFormatted - 1) * limitFormatted : 0

  const pagination = {
    pageFormatted,
    limitFormatted,
    offset
  }
  const dataFiltered = moviesQueryParams(
    {
      allQueries: req.query,
      dataToFilter: allMoviesJSON
    },
    { pagination }
  )

  formatResponse({
    _actualFormat: req._format,
    theResMethod: res,
    theResBody: dataFiltered
  })
})

router_movies.route(`/:id`).get((req, res) => {
  const { id } = req.params

  if (id.toLowerCase() === "keys") {
    return res.status(200).send({ keys: QUERY_KEYS })
  }

  const movie = allMoviesJSON.find((movie) => movie.id === id)
  if (!movie) {
    return res.status(404).send({ error: `Movie not found with id «${id}»` })
  } else {
    formatResponse({
      _actualFormat: req._format,
      theResMethod: res,
      theResBody: movie
    })
  }
})

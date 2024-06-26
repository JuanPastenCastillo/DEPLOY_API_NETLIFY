/* node --watch app.js */

import cors from "cors"
import express from "express"
import crypto from "node:crypto"
import serverless from "serverless-http"
import { allMoviesJSON } from "../data/movies.js"
import { validateMovie, validatePartialMovies } from "../schemas/movies.js"
import { formatResponse } from "../utils/formatResponse.js"
import { QUERY_KEYS, moviesQueryParams } from "../utils/moviesQueryParams.js"
import { originChecked } from "../utils/originChecked.js"
import { toJSON } from "../utils/toJSON.js"

// const serverless = require("serverless-http")
// const crypto = require("node:crypto")
// const cors = require("cors")
// const { validateMovie, validatePartialMovies } = require("../schemas/movies")
// const allMoviesJSON = require("../data/movies.json")
// const { toJSON } = require("../utils/toJSON")
// const { formatResponse } = require("../utils/formatResponse")
// const { moviesQueryParams, QUERY_KEYS } = require("../utils/moviesQueryParams")
// const { originChecked } = require("../utils/originChecked")

const app = express()
app.disable("x-powered-by")

const PREFIX_ROUTES = "/.netlify/functions/app"

const ROUTES = {
  MOVIES: `${PREFIX_ROUTES}/movies`,
  HOME: `${PREFIX_ROUTES}/`
}

const ACCEPTED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:3000",
  "https://movies.com", // This could be the production
  "https://main--voluble-sfogliatella-08c09e.netlify.app/.netlify/functions/app", // This could be the production
  "https://juanpastencastillo.com"
]

const corsOptions = {
  origin: (origin, callback) => {
    if (ACCEPTED_ORIGINS.indexOf(origin) !== -1 || !origin) {
      callback(null, true)
    } else {
      callback(new Error("Not allowed by CORS"))
    }
  },
  optionSuccessStatus: 200
}

app.use(cors(corsOptions))

app.get("/test", (req, res) => {
  res.json({
    hello: "test!"
  })
})

app.get(ROUTES.HOME, (req, res) => {
  res.json({ message: "This is the endpoint for home" })
})

app.use((req, res, next) => {
  if (req.url.startsWith(ROUTES.MOVIES)) {
    if (req.method === "GET") {
      // const { acceptedOrigin, origin } = originChecked({
      //   req,
      //   ACCEPTED_ORIGINS
      // })

      // if (!acceptedOrigin) {
      //   return res.status(403).send({ error: "Origin not accepted" })
      // }

      // res.header("Access-Control-Allow-Origin", origin)

      const { format = "json" } = req.query

      if (format.toLowerCase() === "json") {
        req._format = "json"

        return next()
      } else {
        req._format = format.toLowerCase()
        return next()
      }
    } else if (req.method === "POST" || req.method === "PATCH") {
      toJSON({ req, next })
    } else if (req.method === "DELETE" && /movies\/*/.test(req.url)) {
      const { acceptedOrigin, origin } = originChecked({
        req,
        ACCEPTED_ORIGINS
      })

      if (!acceptedOrigin) {
        return res.status(403).send({ error: "Origin not accepted" })
      }

      res.header("Access-Control-Allow-Origin", origin)

      return next()
    } else if (req.method === "OPTIONS") {
      const { acceptedOrigin, origin } = originChecked({
        req,
        ACCEPTED_ORIGINS
      })

      if (!acceptedOrigin) {
        return res.status(403).send({ error: "Origin not accepted" })
      }

      res.header("Access-Control-Allow-Origin", origin)
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE"
      )
      res.sendStatus(204)
    } else {
      return next()
    }
  } else {
    return next()
  }
})

// app.get(ROUTES.MOVIES, router_movies)

app.get(ROUTES.MOVIES, (req, res) => {
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

app.get(`${ROUTES.MOVIES}/:id`, (req, res) => {
  const { id } = req.params

  if (id.toLowerCase() === "keys") {
    return res.status(200).send({ keys: QUERY_KEYS })
  }

  const movie = allMoviesJSON.find((movie) => movie.id === id)
  console.log("movie:", movie)
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

app.post(ROUTES.MOVIES, (req, res) => {
  const requestValidated = validateMovie({ objectToValidate: req.body })

  if (requestValidated.error) {
    return res
      .status(400)
      .json({ error: JSON.parse(requestValidated.error.message) })
  }
  const newMovie = {
    id: crypto.randomUUID(), // uuid v4
    idToPATCH: Object.keys(allMoviesJSON).length + 1,
    ...requestValidated.data
  }

  allMoviesJSON.push(newMovie)

  res.status(201).json(newMovie)
})

app.patch(`${ROUTES.MOVIES}/:idToPATCH`, (req, res) => {
  const requestValidated = validatePartialMovies({ objectToValidate: req.body })
  if (requestValidated.error) {
    return res
      .status(400)
      .json({ error: JSON.parse(requestValidated.error.message) })
  }

  const { idToPATCH } = req.params
  const movieIndex = allMoviesJSON.findIndex((movie) => {
    return Number(movie?.idToPATCH) === Number(idToPATCH)
  })

  if (movieIndex === -1) {
    return res
      .status(404)
      .json({ message: `Movie not found with id «${idToPATCH}»` })
  }

  const updatedMovie = {
    ...allMoviesJSON[movieIndex],
    ...requestValidated.data
  }

  allMoviesJSON[movieIndex] = updatedMovie

  return res.json(updatedMovie)
})

app.delete(`${ROUTES.MOVIES}/:id`, (req, res) => {
  const { id } = req.params
  const movieIndex = allMoviesJSON.findIndex((movie) => {
    return Number(movie?.id) === Number(id) || movie.id === id
  })

  if (movieIndex === -1) {
    return res.status(404).json({ error: `Movie not found with id «${id}»` })
  }

  allMoviesJSON.splice(movieIndex, 1)
  return res.json({ message: `Movie deleted with id «${id}»` })
})

const handler = serverless(app)
module.exports.handler = async (event, context) => {
  const result = await handler(event, context)
  return result
}

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => {
  console.log(`Server listening on port http://localhost:${PORT}`)
})

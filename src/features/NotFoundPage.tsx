import { Link } from 'react-router-dom'
import { copy } from '../content/copy'

export function NotFoundPage() {
  return (
    <div className="card card-raised p-6">
      <h1 className="font-display text-2xl font-bold">{copy.notFound.title}</h1>
      <Link to="/" className="btn btn-primary mt-4">
        {copy.notFound.back}
      </Link>
    </div>
  )
}

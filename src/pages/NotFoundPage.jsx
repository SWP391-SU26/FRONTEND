import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../components/ui.jsx'

const studyImage =
  'https://images.pexels.com/photos/7777679/pexels-photo-7777679.jpeg?auto=compress&cs=tinysrgb&w=1400'

function NotFoundPage() {
  return (
    <EmptyState
      action={
        <Link to="/workspace">
          <Button>
            <ArrowLeft size={16} />
            Back to workspace
          </Button>
        </Link>
      }
      description="This frontend route does not exist. Use AI Chat or Library to return to the main FStu workspace."
      image={studyImage}
      title="Page not found"
    />
  )
}

export default NotFoundPage

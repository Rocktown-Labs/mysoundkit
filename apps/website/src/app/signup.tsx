import { useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Music, ArrowLeft, Mic, Users } from 'lucide-react'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const router = useRouter()
  const [accountType, setAccountType] = useState<'artist' | 'fan' | null>(null)

  if (accountType === 'artist') {
    router.navigate({ to: '/signup/artist/credentials' })
    return null
  }
  if (accountType === 'fan') {
    router.navigate({ to: '/signup/fan/credentials' })
    return null
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center space-x-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to home</span>
          </Link>
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Music className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold font-notable">SoundKit</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Join SoundKit</h1>
          <p className="text-muted-foreground text-lg">Choose how you want to use the platform</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            className="group hover:border-primary transition-all cursor-pointer"
            onClick={() => setAccountType('artist')}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Mic className="size-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">I'm an Artist</CardTitle>
              <CardDescription className="text-base">
                Share your music, battle other artists, and grow your fanbase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center"><span className="mr-2">✓</span>Upload and sell your tracks</li>
                <li className="flex items-center"><span className="mr-2">✓</span>Compete in live battles</li>
                <li className="flex items-center"><span className="mr-2">✓</span>Build your artist profile</li>
                <li className="flex items-center"><span className="mr-2">✓</span>Access artist dashboard & analytics</li>
              </ul>
              <Button className="w-full mt-6" size="lg">Continue as Artist</Button>
            </CardContent>
          </Card>

          <Card
            className="group hover:border-primary transition-all cursor-pointer"
            onClick={() => setAccountType('fan')}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 size-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Users className="size-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">I'm a Fan</CardTitle>
              <CardDescription className="text-base">
                Discover new music, support artists, and build your library
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center"><span className="mr-2">✓</span>Discover and stream music</li>
                <li className="flex items-center"><span className="mr-2">✓</span>Watch and vote in battles</li>
                <li className="flex items-center"><span className="mr-2">✓</span>Create playlists and save tracks</li>
                <li className="flex items-center"><span className="mr-2">✓</span>Purchase and support artists</li>
              </ul>
              <Button className="w-full mt-6" size="lg">Continue as Fan</Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:text-primary/80 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

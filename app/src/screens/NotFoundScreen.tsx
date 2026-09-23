import { Link } from 'react-router';
import { Screen } from '../components/Screen';

export function NotFoundScreen() {
  return (
    <Screen title="Not found">
      <p>There’s nothing at this address.</p>
      <p>
        <Link className="button secondary" to="/">
          Go to Home
        </Link>
      </p>
    </Screen>
  );
}

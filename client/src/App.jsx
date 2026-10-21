import { Link, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import ReceiverPage from './pages/ReceiverPage.jsx';
import SenderPage from './pages/SenderPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <>
      <div className="page-backdrop" aria-hidden="true" />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/receive/:token" element={<ReceiverPage />} />
        <Route path="/s/:token" element={<SenderPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const RouterContext = createContext(null);

export function Router({ children }) {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  const value = useMemo(
    () => ({
      pathname,
      navigate(to, options = {}) {
        window.history[options.replace ? "replaceState" : "pushState"](
          {},
          "",
          to,
        );
        setPathname(window.location.pathname);
        window.scrollTo({ top: 0, behavior: "instant" });
      },
    }),
    [pathname],
  );

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}

function useRouter() {
  const router = useContext(RouterContext);
  if (!router) {
    throw new Error("Router components must be rendered inside Router.");
  }
  return router;
}

export function Link({ href, onClick, target, children, ...props }) {
  const { navigate } = useRouter();

  function handleClick(event) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === "_blank"
    ) {
      return;
    }

    const destination = new URL(href, window.location.href);
    // External links retain normal browser navigation.
    if (destination.origin !== window.location.origin) return;

    event.preventDefault();
    navigate(`${destination.pathname}${destination.search}${destination.hash}`);
  }

  return (
    <a href={href} onClick={handleClick} target={target} {...props}>
      {children}
    </a>
  );
}

export function usePathname() {
  return useRouter().pathname;
}

export function useParams() {
  const pathname = usePathname();
  const match = pathname.match(/^\/auctions\/([^/]+)$/);
  return { id: match ? decodeURIComponent(match[1]) : undefined };
}

export function Navigate({ to, replace = false }) {
  const { navigate } = useRouter();

  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);

  return null;
}

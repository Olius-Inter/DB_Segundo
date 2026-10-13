-- Somente para o banco descartável do CI, enquanto access_control não estiver
-- presente nesta branch. Não substitui a configuração de produção nem a testa.
BEGIN;
CREATE ROLE olius_api NOLOGIN;
CREATE ROLE olius_auth_owner NOLOGIN;
GRANT USAGE ON SCHEMA public TO olius_api, olius_auth_owner;
GRANT SELECT, INSERT, UPDATE ON public.auth_session, public.auth_refresh_token TO olius_auth_owner;
GRANT INSERT ON public.auth_session_log TO olius_auth_owner;
GRANT SELECT (id, user_type, status), UPDATE (id) ON public.users TO olius_auth_owner;
GRANT CREATE ON SCHEMA public TO olius_auth_owner;
ALTER FUNCTION public.auth_idle_duration(public.user_type_t) OWNER TO olius_auth_owner;
ALTER FUNCTION public.open_auth_session(UUID, BYTEA) OWNER TO olius_auth_owner;
ALTER FUNCTION public.rotate_auth_refresh_token(BYTEA, BYTEA) OWNER TO olius_auth_owner;
ALTER FUNCTION public.revoke_auth_session(UUID, UUID) OWNER TO olius_auth_owner;
ALTER FUNCTION public.revoke_user_auth_sessions(UUID) OWNER TO olius_auth_owner;
ALTER FUNCTION public.get_auth_session_status(UUID, UUID) OWNER TO olius_auth_owner;
ALTER FUNCTION public.fn_olius_auth_session_audit() OWNER TO olius_auth_owner;
ALTER FUNCTION public.fn_olius_auth_user_inactive() OWNER TO olius_auth_owner;
REVOKE CREATE ON SCHEMA public FROM olius_auth_owner;
REVOKE ALL ON public.auth_session, public.auth_refresh_token, public.auth_session_log FROM PUBLIC, olius_api;
REVOKE ALL ON FUNCTION public.auth_idle_duration(public.user_type_t),
    public.fn_olius_auth_session_audit(), public.fn_olius_auth_user_inactive(),
    public.fn_olius_auth_token_guard(), public.fn_olius_auth_session_guard() FROM PUBLIC, olius_api;
GRANT EXECUTE ON FUNCTION public.open_auth_session(UUID, BYTEA),
    public.rotate_auth_refresh_token(BYTEA, BYTEA), public.revoke_auth_session(UUID, UUID),
    public.revoke_user_auth_sessions(UUID), public.get_auth_session_status(UUID, UUID) TO olius_api;
COMMIT;

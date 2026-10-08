-- Bloco para substituir o SELECT final da consulta WITH do Script 06.
-- annual_scores é uma CTE dessa consulta; este bloco não executa isoladamente.
SELECT
    a.profile,
    a.ranking_year,
    a.participant_id,
    a.annual_points,
    DENSE_RANK() OVER (
        PARTITION BY a.profile, a.ranking_year
        ORDER BY a.annual_points DESC
    ) AS ranking_position
FROM annual_scores AS a
ORDER BY a.profile, a.ranking_year, ranking_position, a.participant_id;

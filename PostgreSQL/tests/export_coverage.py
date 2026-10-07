"""Converte contadores reais de plpgsql_check em cobertura genérica do Sonar.

Só instruções PL/pgSQL são mensuráveis. NULL/zero = não executado.
Uma linha com várias instruções só é coberta quando todas foram exercitadas.
Não considera DDL, linguagem SQL, helpers de teste ou simples CREATE como cobertura.
"""
import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET


def build_report(root, routines):
    sources = {p: p.read_text(encoding="utf-8-sig").replace("\r\n", "\n")
               for p in (root / "PostgreSQL").glob("0[45]_*.sql")}
    lines = {}
    for routine in routines:
        body = routine["source"].replace("\r\n", "\n")
        matches = [(path, text, text.find(body)) for path, text in sources.items()
                   if body and text.count(body) == 1]
        if len(matches) != 1:
            raise ValueError(f"Corpo não localizado de forma única no checkout: {routine['signature']}")
        path, text, start = matches[0]
        offset = text[:start].count("\n")
        body_lines = body.splitlines()
        for stmt in routine["statements"]:
            number = stmt["lineno"]
            # Blocos são contêineres estruturais; seus contadores não provam que
            # as instruções internas foram todas exercitadas.
            if stmt["stmtname"] == "statement block" or not number or number < 1:
                continue
            if number > len(body_lines):
                raise ValueError(f"Linha fora do corpo: {routine['signature']}:{number}")
            location = (path.relative_to(root).as_posix(), offset + number)
            executed = (stmt.get("exec_stmts") or 0) > 0 or (stmt.get("exec_stmts_err") or 0) > 0
            lines.setdefault(location, []).append(executed)
    if not lines:
        raise ValueError("Nenhuma instrução mensurável encontrada; não gerar cobertura vazia.")
    report = ET.Element("coverage", version="1")
    file_nodes = {}
    for (path, number), states in sorted(lines.items()):
        if path not in file_nodes:
            file_nodes[path] = ET.SubElement(report, "file", path=path)
        ET.SubElement(file_nodes[path], "lineToCover", lineNumber=str(number),
                      covered=str(all(states)).lower())
    return report, sum(all(v) for v in lines.values()), len(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--profile", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    routines = json.loads(args.profile.read_text(encoding="utf-8"))
    report, covered, total = build_report(args.root.resolve(), routines)
    ET.indent(report)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(report).write(args.output, encoding="utf-8", xml_declaration=True)
    print(f"PL/pgSQL: {covered}/{total} linhas de instruções exercitadas ({covered / total:.1%}).")
    print("A cobertura no Sonar pode diferir: este relatório mede somente linhas de instruções PL/pgSQL.")


if __name__ == "__main__":
    main()

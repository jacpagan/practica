#!/usr/bin/env python3

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / 'apps' / 'backend'

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'practica.settings')

import django  # noqa: E402

django.setup()

from django.apps import apps  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402
from django.db import connection  # noqa: E402
from django.db.utils import ProgrammingError, OperationalError  # noqa: E402
from django.db.models.fields.related import ForeignKey, OneToOneField, ManyToManyField  # noqa: E402


SYSTEM_TABLE_PREFIXES = ('django_', 'auth_', 'authtoken_')
IGNORED_EXTRA_TABLES = {
    'auth_group_permissions',
    'auth_user_groups',
    'auth_user_user_permissions',
    'django_migrations',
}


def safe_count(cursor, table_name):
    try:
        cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
        return cursor.fetchone()[0]
    except Exception as exc:
        return f'error: {exc.__class__.__name__}'


def safe_scalar(cursor, sql, params=None):
    try:
        cursor.execute(sql, params or [])
        row = cursor.fetchone()
        return row[0] if row else 0
    except Exception:
        return None


def get_actual_tables(cursor):
    return sorted(connection.introspection.table_names(cursor))


def get_current_model_tables():
    tables = {}
    for model in apps.get_models():
        tables[model._meta.db_table] = model
    return tables


def count_user_sessions(cursor, username):
    actual_tables = set(get_actual_tables(cursor))
    auth_user_exists = 'auth_user' in actual_tables
    session_exists = 'videos_session' in actual_tables
    if not auth_user_exists or not session_exists:
        return {
            'matched_users': [],
            'session_count': None,
            'reason': 'required tables not present',
        }

    user_rows = []
    if connection.vendor == 'postgresql':
        match_op = 'ILIKE'
    else:
        match_op = 'LIKE'

    try:
        cursor.execute(
            f"""
            SELECT id, username, email
            FROM auth_user
            WHERE username = %s OR email = %s
               OR username {match_op} %s OR email {match_op} %s
            ORDER BY id
            """,
            [username, username, f'%{username}%', f'%{username}%'],
        )
        user_rows = cursor.fetchall()
    except Exception as exc:
        return {
            'matched_users': [],
            'session_count': None,
            'reason': f'user lookup failed: {exc.__class__.__name__}',
        }

    user_ids = [row[0] for row in user_rows]
    if not user_ids:
        return {
            'matched_users': [],
            'session_count': 0,
            'reason': 'no matching user found',
        }

    placeholders = ', '.join(['%s'] * len(user_ids))
    sql = f'SELECT COUNT(*) FROM "videos_session" WHERE "user_id" IN ({placeholders})'
    count = safe_scalar(cursor, sql, user_ids)

    return {
        'matched_users': [
            {'id': row[0], 'username': row[1], 'email': row[2] or ''}
            for row in user_rows
        ],
        'session_count': count,
        'reason': '',
    }


def table_counts(cursor, tables):
    rows = []
    for table_name in tables:
        rows.append((table_name, safe_count(cursor, table_name)))
    return rows


def relationship_usage(cursor, actual_tables):
    usages = []
    seen = set()

    for model in apps.get_models():
        table_name = model._meta.db_table
        if table_name not in actual_tables:
            continue

        for field in model._meta.get_fields():
            if field.auto_created and not field.concrete:
                continue

            if isinstance(field, (ForeignKey, OneToOneField)):
                column = field.column
                key = (table_name, column, field.related_model._meta.db_table)
                if key in seen:
                    continue
                seen.add(key)
                total = safe_scalar(cursor, f'SELECT COUNT(*) FROM "{table_name}"')
                nonnull = safe_scalar(cursor, f'SELECT COUNT(*) FROM "{table_name}" WHERE "{column}" IS NOT NULL')
                distinct_refs = safe_scalar(cursor, f'SELECT COUNT(DISTINCT "{column}") FROM "{table_name}" WHERE "{column}" IS NOT NULL')
                usages.append({
                    'type': 'fk',
                    'relation': f'{table_name}.{column} -> {field.related_model._meta.db_table}.id',
                    'total_rows': total,
                    'used_rows': nonnull,
                    'distinct_refs': distinct_refs,
                })

            elif isinstance(field, ManyToManyField) and not field.auto_created:
                through = field.remote_field.through
                through_table = through._meta.db_table
                if through_table not in actual_tables:
                    continue
                source_col = field.m2m_column_name()
                target_col = field.m2m_reverse_name()
                key = (through_table, source_col, target_col)
                if key in seen:
                    continue
                seen.add(key)
                total = safe_scalar(cursor, f'SELECT COUNT(*) FROM "{through_table}"')
                distinct_left = safe_scalar(cursor, f'SELECT COUNT(DISTINCT "{source_col}") FROM "{through_table}"')
                distinct_right = safe_scalar(cursor, f'SELECT COUNT(DISTINCT "{target_col}") FROM "{through_table}"')
                usages.append({
                    'type': 'm2m',
                    'relation': f'{through_table}.{source_col}/{target_col}',
                    'total_rows': total,
                    'used_rows': total,
                    'distinct_refs': (distinct_left, distinct_right),
                })

    usages.sort(key=lambda item: (item['used_rows'] or 0, item['total_rows'] or 0), reverse=True)
    return usages


def print_header(title):
    print(f'\n{title}')
    print('-' * len(title))


def main():
    parser = argparse.ArgumentParser(description='Read-only database usage audit for Practica.')
    parser.add_argument('--username', default='jac', help='Username or email fragment to inspect (default: jac)')
    parser.add_argument('--top', type=int, default=15, help='Number of top rows to show (default: 15)')
    args = parser.parse_args()

    try:
        with connection.cursor() as cursor:
            actual_tables = set(get_actual_tables(cursor))
            current_model_tables = get_current_model_tables()
            current_table_names = set(current_model_tables.keys())

            print_header('Database')
            print(f'vendor: {connection.vendor}')
            print(f'name: {connection.settings_dict.get("NAME")}')
            print(f'host: {connection.settings_dict.get("HOST") or "local"}')
            print(f'tables: {len(actual_tables)}')

            user_audit = count_user_sessions(cursor, args.username)
            print_header(f'User Audit: {args.username}')
            if user_audit['matched_users']:
                for user in user_audit['matched_users']:
                    print(f'user: id={user["id"]} username={user["username"]} email={user["email"]}')
            else:
                print('user: none found')
            print(f'session_count: {user_audit["session_count"]}')
            if user_audit['reason']:
                print(f'note: {user_audit["reason"]}')

            all_counts = table_counts(cursor, sorted(actual_tables))
            all_counts_sorted = sorted(
                all_counts,
                key=lambda item: item[1] if isinstance(item[1], int) else -1,
                reverse=True,
            )
            print_header('Top Tables By Row Count')
            for table_name, count in all_counts_sorted[:args.top]:
                print(f'{count:>8}  {table_name}')

            product_tables = sorted(name for name in actual_tables if name.startswith('videos_'))
            product_counts = sorted(
                table_counts(cursor, product_tables),
                key=lambda item: item[1] if isinstance(item[1], int) else -1,
                reverse=True,
            )
            print_header('Product Tables By Row Count')
            for table_name, count in product_counts:
                print(f'{count:>8}  {table_name}')

            zero_current_tables = []
            missing_current_tables = []
            for table_name in sorted(current_table_names):
                if table_name not in actual_tables:
                    missing_current_tables.append(table_name)
                    continue
                count = safe_count(cursor, table_name)
                if count == 0:
                    zero_current_tables.append(table_name)

            print_header('Current Model Tables With Zero Rows')
            if zero_current_tables:
                for table_name in zero_current_tables:
                    print(table_name)
            else:
                print('none')

            print_header('Current Model Tables Missing From Database')
            if missing_current_tables:
                for table_name in missing_current_tables:
                    print(table_name)
            else:
                print('none')

            extra_domain_tables = []
            for table_name in sorted(actual_tables - current_table_names):
                if table_name.startswith('videos_') and table_name not in IGNORED_EXTRA_TABLES:
                    extra_domain_tables.append(table_name)

            print_header('Database Tables Not In Current Models')
            if extra_domain_tables:
                for table_name in extra_domain_tables:
                    print(table_name)
            else:
                print('none')

            relations = relationship_usage(cursor, actual_tables)
            print_header('Most Used Relationships')
            if relations:
                for item in relations[:args.top]:
                    print(
                        f'{item["used_rows"]:>8} used / {item["total_rows"]:>8} rows  '
                        f'{item["relation"]}  distinct={item["distinct_refs"]}'
                    )
            else:
                print('none')

    except (ProgrammingError, OperationalError) as exc:
        print(f'database audit failed: {exc.__class__.__name__}: {exc}', file=sys.stderr)
        return 1

    return 0


if __name__ == '__main__':
    raise SystemExit(main())

"""
Admin utilities for THERMASCAN AI

Usage:
  python admin.py create-doctor <email> <password> <name> <clinic>
  python admin.py list-doctors
  python admin.py delete-doctor <uid>
"""

import sys
import argparse
import firebase_admin
from firebase_admin import credentials, auth, firestore

db = None  # set after init

def init_firebase():
    global db
    try:
        firebase_admin.initialize_app(credentials.Certificate('serviceAccountKey.json'))
    except ValueError:
        print("Firebase already initialized")
    db = firestore.client()  # ← moved here, runs AFTER initialize_app()

def create_doctor(email, password, name, clinic):
    try:
        user = auth.create_user(email=email, password=password)
        db.collection('users').document(user.uid).set({
            'name': name,
            'email': email,
            'role': 'doctor',
            'clinic': clinic,
            'createdAt': firestore.SERVER_TIMESTAMP,
        })
        print(f"✅ Doctor created: {email}")
        print(f"   UID: {user.uid}")
        print(f"   Name: {name}")
        print(f"   Clinic: {clinic}")
    except Exception as e:
        print(f"❌ Error: {e}")

def list_doctors():
    try:
        doctors = db.collection('users').where('role', '==', 'doctor').stream()
        count = 0
        for doc in doctors:
            data = doc.to_dict()
            print(f"\n{count+1}. {data.get('name', 'N/A')}")
            print(f"   Email: {data.get('email')}")
            print(f"   Clinic: {data.get('clinic', 'N/A')}")
            print(f"   UID: {doc.id}")
            count += 1
        print("No doctors found" if count == 0 else f"\nTotal: {count} doctors")
    except Exception as e:
        print(f"❌ Error: {e}")

def delete_doctor(uid):
    try:
        auth.delete_user(uid)
        db.collection('users').document(uid).delete()
        print(f"✅ Doctor deleted: {uid}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    init_firebase()  # ← Firebase ready before anything else runs

    parser = argparse.ArgumentParser(description='THERMASCAN AI Admin Utilities')
    subparsers = parser.add_subparsers(dest='command')

    create_parser = subparsers.add_parser('create-doctor')
    create_parser.add_argument('email')
    create_parser.add_argument('password')
    create_parser.add_argument('name')
    create_parser.add_argument('clinic')

    subparsers.add_parser('list-doctors')

    delete_parser = subparsers.add_parser('delete-doctor')
    delete_parser.add_argument('uid')

    args = parser.parse_args()

    if args.command == 'create-doctor':
        create_doctor(args.email, args.password, args.name, args.clinic)
    elif args.command == 'list-doctors':
        list_doctors()
    elif args.command == 'delete-doctor':
        delete_doctor(args.uid)
    else:
        parser.print_help()
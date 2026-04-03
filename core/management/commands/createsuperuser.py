from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Creates a superuser'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, default='admin')
        parser.add_argument('--email', type=str, default='admin@taller.com')
        parser.add_argument('--password', type=str, default='admin123')
        parser.add_argument('--reset', action='store_true', help='Reset password if user exists')

    def handle(self, *args, **options):
        username = options['username']
        email = options['email']
        password = options['password']
        
        if User.objects.filter(username=username).exists():
            if options['reset']:
                user = User.objects.get(username=username)
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(f'Password reset for user: {username}'))
            else:
                self.stdout.write(self.style.WARNING(f'User {username} already exists. Use --reset to update password.'))
            return

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            is_staff=True,
            is_superuser=True
        )
        
        self.stdout.write(self.style.SUCCESS(f'Superuser created: {username} / {password}'))
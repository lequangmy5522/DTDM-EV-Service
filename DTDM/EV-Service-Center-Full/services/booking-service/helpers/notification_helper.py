import requests
import os
from flask import current_app

class NotificationHelper:
    """Helper class to send notifications to notification-service"""

    @staticmethod
    def send_notification(user_id, notification_type, title, message,
                         channel="in_app", priority="medium",
                         related_entity_type=None, related_entity_id=None,
                         metadata=None):
        """
        Send notification to notification-service via internal API

        Args:
            user_id: ID of user to notify
            notification_type: Type of notification (booking_status, payment, etc.)
            title: Notification title
            message: Notification message
            channel: Channel to send (in_app, email, sms, push)
            priority: Priority level (low, medium, high, urgent)
            related_entity_type: Type of related entity (booking, invoice, etc.)
            related_entity_id: ID of related entity
            metadata: Additional metadata as dict

        Returns:
            tuple: (success: bool, response_data: dict or error_message: str)
        """
        try:
            # Get internal service token from environment
            internal_token = os.getenv("INTERNAL_SERVICE_TOKEN")
            if not internal_token:
                return False, "INTERNAL_SERVICE_TOKEN not configured"

            # Get notification service URL
            notification_service_url = os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8005")

            # Prepare notification data
            notification_data = {
                "user_id": user_id,
                "notification_type": notification_type,
                "title": title,
                "message": message,
                "channel": channel,
                "priority": priority
            }

            # Add optional fields
            if related_entity_type:
                notification_data["related_entity_type"] = related_entity_type
            if related_entity_id:
                notification_data["related_entity_id"] = related_entity_id
            if metadata:
                # Convert metadata dict to string if needed
                import json
                notification_data["extra_data"] = json.dumps(metadata) if isinstance(metadata, dict) else metadata

            # Send request to notification service
            response = requests.post(
                f"{notification_service_url}/internal/notifications/create",
                json=notification_data,
                headers={
                    "Content-Type": "application/json",
                    "X-Internal-Token": internal_token
                },
                timeout=5
            )

            if response.status_code in [200, 201]:
                return True, response.json()
            else:
                error_msg = f"Failed to create notification: {response.status_code} - {response.text}"
                print(f"⚠️ {error_msg}")
                return False, error_msg

        except requests.exceptions.RequestException as e:
            error_msg = f"Error connecting to notification service: {str(e)}"
            print(f"⚠️ {error_msg}")
            return False, error_msg
        except Exception as e:
            error_msg = f"Unexpected error sending notification: {str(e)}"
            print(f"⚠️ {error_msg}")
            return False, error_msg

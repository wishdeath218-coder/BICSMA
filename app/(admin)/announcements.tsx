import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, FlatList, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useApp } from '../../src/context/AppContext';
import { Announcement } from '../../src/types';
import { Colors } from '../../src/constants/colors';
import PrimaryButton from '../../src/components/PrimaryButton';
import * as ImagePicker from 'expo-image-picker';

type AnnType = 'News' | 'Advisory' | 'Event';
const ANN_TYPES: AnnType[] = ['News', 'Advisory', 'Event'];

const typeMeta: Record<AnnType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  News: { icon: 'newspaper-outline', color: Colors.green, bg: Colors.greenLight },
  Advisory: { icon: 'warning-outline', color: Colors.red, bg: Colors.redLight },
  Event: { icon: 'calendar-outline', color: Colors.blue, bg: Colors.blueLight },
};

import { stickyHeader } from '../../src/utils/ui';

export default function AnnouncementsScreen() {
  const { announcements, addAnnouncement, updateAnnouncement, deleteAnnouncement, uploadAnnouncementImage } = useApp();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<'compose' | 'published'>('compose');

  const [title, setTitle] = useState('');
  const [type, setType] = useState<AnnType>('News');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [existingImage, setExistingImage] = useState<string>();
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string>();
  const [attachment, setAttachment] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Toast.show({
            type: 'error',
            text1: 'Permission Required',
            text2: 'Allow photo library access to choose an announcement image.',
          });
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        Toast.show({ type: 'error', text1: 'Photo Unavailable', text2: 'Please choose another photo.' });
        return;
      }
      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        Toast.show({
          type: 'error',
          text1: 'Unsupported Image',
          text2: 'Choose a JPEG, PNG, or WebP image.',
        });
        return;
      }
      setImage(asset);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Unable to Select Image',
        text2: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) { Toast.show({ type: 'error', text1: 'Required', text2: 'Title is required.' }); return; }
    if (!summary.trim()) { Toast.show({ type: 'error', text1: 'Required', text2: 'Summary is required.' }); return; }
    if (content.trim().length < 20) { Toast.show({ type: 'error', text1: 'Required', text2: 'Full content must be at least 20 characters.' }); return; }

    setLoading(true);
    try {
      const id = `ann-${Date.now()}`;
      const imageUrl = image
        ? await uploadAnnouncementImage(image.uri, image.base64 ?? '', image.mimeType ?? 'image/jpeg', id)
        : existingImage;
      const ann: Announcement = {
        id: editingAnnouncementId ?? id,
        title: title.trim(),
        type,
        date: editingAnnouncementId
          ? announcements.find((item) => item.id === editingAnnouncementId)?.date ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        summary: summary.trim(),
        content: content.trim(),
        urgent,
        image: imageUrl,
        attachment: attachment.trim() || undefined,
        timeLeft: type === 'Event' && timeLeft.trim() ? timeLeft.trim() : undefined,
        engagementCount: editingAnnouncementId
          ? announcements.find((item) => item.id === editingAnnouncementId)?.engagementCount ?? 0
          : 0,
      };

      if (editingAnnouncementId) {
        await updateAnnouncement(ann);
        Toast.show({ type: 'success', text1: 'Bulletin Updated', text2: `"${ann.title}" has been updated.` });
      } else {
        await addAnnouncement(ann);
        Toast.show({ type: 'success', text1: 'Bulletin Published!', text2: `"${ann.title}" is now live.` });
      }

      setTitle(''); setSummary(''); setContent(''); setUrgent(false); setType('News');
      setImage(null); setExistingImage(undefined); setEditingAnnouncementId(undefined); setAttachment(''); setTimeLeft('');
      setTab('published');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Unable to Publish Bulletin',
        text2: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (announcement: Announcement) => {
    setEditingAnnouncementId(announcement.id);
    setTitle(announcement.title);
    setType(announcement.type);
    setSummary(announcement.summary);
    setContent(announcement.content);
    setUrgent(announcement.urgent ?? false);
    setImage(null);
    setExistingImage(announcement.image);
    setAttachment(announcement.attachment ?? '');
    setTimeLeft(announcement.timeLeft ?? '');
    setTab('compose');
  };

  const cancelEditing = () => {
    setEditingAnnouncementId(undefined);
    setTitle(''); setSummary(''); setContent(''); setUrgent(false); setType('News');
    setImage(null); setExistingImage(undefined); setAttachment(''); setTimeLeft('');
  };

  const confirmDelete = (announcement: Announcement) => {
    Alert.alert(
      'Delete Bulletin',
      `Delete "${announcement.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteAnnouncement(announcement.id)
              .then(() => Toast.show({ type: 'success', text1: 'Bulletin Deleted' }))
              .catch((error: unknown) => Toast.show({
                type: 'error',
                text1: 'Unable to Delete Bulletin',
                text2: error instanceof Error ? error.message : 'Please try again.',
              }));
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 bg-canvas dark:bg-canvas-dark">
        {/* Header */}
        <View
          className="bg-white dark:bg-surface-dark px-4 pb-3 border-b border-border dark:border-border-dark gap-2"
          style={[stickyHeader, { paddingTop: insets.top + 12 }]}
        >
          <Text className="text-xl font-black text-ink dark:text-ink-dark">Announcements</Text>
          <Text className="text-xs text-muted dark:text-muted-dark">Compose and publish community bulletins</Text>

          <View className="flex-row gap-2">
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-[9px] rounded-[10px] border ${
                tab === 'compose' ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'
              }`}
              onPress={() => setTab('compose')}
            >
              <Ionicons name="create-outline" size={14} color={tab === 'compose' ? Colors.white : Colors.gray} />
              <Text className={`text-[13px] font-semibold ${tab === 'compose' ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>Compose</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center gap-1.5 py-[9px] rounded-[10px] border ${
                tab === 'published' ? 'bg-primary border-primary' : 'bg-gray-light dark:bg-surface-dark-2 border-border dark:border-border-dark'
              }`}
              onPress={() => setTab('published')}
            >
              <Ionicons name="list-outline" size={14} color={tab === 'published' ? Colors.white : Colors.gray} />
              <Text className={`text-[13px] font-semibold ${tab === 'published' ? 'text-white' : 'text-gray dark:text-ink-dark'}`}>
                Published ({announcements.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {tab === 'compose' ? (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: insets.bottom + 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="bg-white dark:bg-surface-dark rounded-2xl border border-border dark:border-border-dark p-4 mb-3.5">
              {/* Type Selector */}
              <Text className="text-xs font-bold text-ink dark:text-ink-dark mb-2">Bulletin Type</Text>
              <View className="flex-row gap-2 mb-4">
                {ANN_TYPES.map((t) => {
                  const active = type === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      className="flex-1 items-center gap-1 py-2.5 rounded-[10px] border-[1.5px] bg-gray-light dark:bg-surface-dark-2"
                      style={active ? { backgroundColor: typeMeta[t].bg, borderColor: typeMeta[t].color } : { borderColor: Colors.border }}
                      onPress={() => setType(t)}
                    >
                      <Ionicons name={typeMeta[t].icon} size={20} color={active ? typeMeta[t].color : Colors.gray} />
                      <Text className="text-xs font-semibold" style={active ? { color: typeMeta[t].color, fontWeight: '700' } : { color: Colors.gray }}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Urgent Toggle */}
              <View className="flex-row items-center gap-3 mb-4 py-2.5 rounded-[10px] bg-gray-light dark:bg-surface-dark-2 px-3">
                <View className="flex-1">
                  <Text className="text-xs font-bold text-ink dark:text-ink-dark mb-2">Mark as Urgent</Text>
                  <Text className="text-[11px] text-muted dark:text-muted-dark mt-0.5">Urgent bulletins are highlighted in the resident feed.</Text>
                </View>
                <Switch value={urgent} onValueChange={setUrgent} trackColor={{ false: Colors.border, true: Colors.red }} thumbColor={Colors.white} />
              </View>

              {/* Title */}
              <Text className="text-xs font-bold text-ink dark:text-ink-dark mb-2">Title *</Text>
              <TextInput
                className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 py-2.5 text-[13px] text-ink dark:text-ink-dark"
                placeholder="Bulletin headline…"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={Colors.textMuted}
              />

              {/* Summary */}
              <Text className="text-xs font-bold text-ink dark:text-ink-dark mb-2 mt-3">Summary *</Text>
              <TextInput
                className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 text-[13px] text-ink dark:text-ink-dark"
                style={{ height: 80, textAlignVertical: 'top', paddingTop: 10 }}
                placeholder="One-paragraph summary displayed in the feed…"
                value={summary}
                onChangeText={setSummary}
                multiline
                placeholderTextColor={Colors.textMuted}
              />

              {/* Full Content */}
              <Text className="text-xs font-bold text-ink dark:text-ink-dark mb-2 mt-3">Full Content *</Text>
              <TextInput
                className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 text-[13px] text-ink dark:text-ink-dark"
                style={{ height: 140, textAlignVertical: 'top', paddingTop: 10 }}
                placeholder="Complete bulletin text shown in the detail view…"
                value={content}
                onChangeText={setContent}
                multiline
                placeholderTextColor={Colors.textMuted}
              />

              {/* Event timing — only relevant for Event bulletins */}
              {type === 'Event' && (
                <>
                  <Text className="text-xs font-bold text-ink dark:text-ink-dark mb-2 mt-3">Event Timing</Text>
                  <TextInput
                    className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 py-2.5 text-[13px] text-ink dark:text-ink-dark"
                    placeholder="e.g. Starts in 3 days · Sat 9:00 AM"
                    value={timeLeft}
                    onChangeText={setTimeLeft}
                    placeholderTextColor={Colors.textMuted}
                  />
                </>
              )}

              {/* Optional bulletin image */}
              <Text className="text-xs font-bold text-ink dark:text-ink-dark mb-2 mt-3">Bulletin Image (optional)</Text>
              <TouchableOpacity
                className="rounded-lg border border-border dark:border-border-dark overflow-hidden bg-gray-light dark:bg-surface-dark-2"
                onPress={pickImage}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={image || existingImage ? 'Choose a different bulletin image' : 'Choose bulletin image from gallery'}
              >
                {image || existingImage ? (
                  <Image source={{ uri: image?.uri ?? existingImage }} className="w-full h-44" resizeMode="cover" />
                ) : (
                  <View className="h-24 flex-row items-center justify-center gap-2">
                    <Ionicons name="image-outline" size={22} color={Colors.textMuted} />
                    <Text className="text-[13px] text-muted dark:text-muted-dark">Choose image from gallery</Text>
                  </View>
                )}
              </TouchableOpacity>
              {(image || existingImage) && (
                <TouchableOpacity
                  className="self-end mt-2"
                  onPress={() => { setImage(null); setExistingImage(undefined); }}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Remove bulletin image"
                >
                  <Text className="text-xs font-semibold text-red">Remove image</Text>
                </TouchableOpacity>
              )}

              {/* Attachment URL (optional) */}
              <Text className="text-xs font-bold text-ink dark:text-ink-dark mb-2 mt-3">Attachment URL (optional)</Text>
              <TextInput
                className="bg-gray-light dark:bg-surface-dark-2 border border-border dark:border-border-dark rounded-lg px-3 py-2.5 text-[13px] text-ink dark:text-ink-dark"
                placeholder="Link to a PDF or document"
                value={attachment}
                onChangeText={setAttachment}
                autoCapitalize="none"
                keyboardType="url"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {editingAnnouncementId && (
              <TouchableOpacity
                className="items-center py-2"
                onPress={cancelEditing}
                disabled={loading}
                accessibilityRole="button"
              >
                <Text className="text-[13px] font-semibold text-muted dark:text-muted-dark">Cancel editing</Text>
              </TouchableOpacity>
            )}
            <PrimaryButton
              label={loading ? (editingAnnouncementId ? 'Saving…' : 'Publishing…') : (editingAnnouncementId ? 'Save Changes' : 'Publish Bulletin')}
              onPress={handlePublish}
              loading={loading}
            />
          </ScrollView>
        ) : (
          <FlatList
            data={announcements}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const meta = typeMeta[item.type];
              return (
                <View className="flex-row items-center gap-3 bg-white dark:bg-surface-dark rounded-[10px] border border-border dark:border-border-dark p-3 mb-2">
                  <View className="w-[42px] h-[42px] rounded-[10px] items-center justify-center" style={{ backgroundColor: meta.bg }}>
                    <Ionicons name={meta.icon} size={18} color={meta.color} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-0.5">
                      <Text className="text-[10px] font-extrabold uppercase" style={{ color: meta.color }}>{item.type}</Text>
                      {item.urgent && <Text className="text-[10px] font-bold text-red">URGENT</Text>}
                    </View>
                    <Text className="text-[13px] font-bold text-ink dark:text-ink-dark" numberOfLines={2}>{item.title}</Text>
                    <Text className="text-[11px] text-muted dark:text-muted-dark mt-0.5">{item.date}</Text>
                  </View>
                  <TouchableOpacity
                    className="w-9 h-9 rounded-lg items-center justify-center bg-gray-light dark:bg-surface-dark-2"
                    onPress={() => startEditing(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${item.title}`}
                  >
                    <Ionicons name="create-outline" size={18} color={Colors.blue} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="w-9 h-9 rounded-lg items-center justify-center bg-red-light"
                    onPress={() => confirmDelete(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${item.title}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.red} />
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

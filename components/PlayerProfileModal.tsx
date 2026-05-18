import { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Save, Edit3, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Model } from "@/components/Player";
import { toast } from "sonner";
import { getLevelFromXP, getXPForLevel, getNextLevelXP } from "@/lib/leveling";

interface PlayerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  currentUserId?: string; // To determine if it's the current user's profile
}

interface ProfileData {
  id: string;
  name: string;
  avatar: string;
  description: string | null;
  experience: number;
}

export function PlayerProfileModal({
  isOpen,
  onClose,
  characterId,
  currentUserId,
}: PlayerProfileModalProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isOwnProfile = currentUserId === characterId;

  useEffect(() => {
    if (isOpen && characterId) {
      setLoading(true);
      import("@/app/actions/user").then(({ getCharacterProfile }) => {
        getCharacterProfile(characterId)
          .then((data) => {
            setProfile(data);
            setEditDescription(data.description || "");
            setLoading(false);
          })
          .catch((err) => {
            console.error(err);
            toast.error("Failed to load profile");
            setLoading(false);
          });
      });
    } else {
      setProfile(null);
      setIsEditing(false);
    }
  }, [isOpen, characterId]);

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", profile.name);
      formData.append("avatar", profile.avatar);
      formData.append("description", editDescription);

      const { updateCharacter } = await import("@/app/actions/character");
      await updateCharacter(formData);

      setProfile({ ...profile, description: editDescription });
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] p-0 bg-gradient-to-b from-[#1a1025] to-[#0B0714] border border-brand-primary/40 cyber-panel overflow-hidden z-[60] shadow-[0_0_40px_rgba(189,0,255,0.15)]">
        <DialogHeader className="sr-only">
          <DialogTitle>Player Profile</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="h-72 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          </div>
        ) : profile ? (
          <div className="flex flex-col relative">
            {/* Header / Avatar Area */}
            <div className="h-56 relative bg-gradient-to-b from-black/60 to-transparent border-b border-brand-primary/30 flex items-center justify-center overflow-hidden">

              {/* 2D Avatar Image as background accent */}
              <div className="absolute left-0 bottom-0 top-0 w-1/2 opacity-30 pointer-events-none z-0 flex items-end">
                <img
                  src={`https://www.boozedbunnytown.com/media/avatars/${profile.avatar}_avatar.webp`}
                  alt="Player Avatar 2D"
                  className="w-full h-auto object-contain object-bottom filter blur-[2px]"
                />
              </div>

              <div className="absolute inset-0 z-0">
                <Canvas className="select-none" shadows>
                  <PerspectiveCamera
                    makeDefault
                    position={[0, 1, 3]}
                    fov={50}
                  />
                  <ambientLight intensity={1.5} />
                  <directionalLight
                    position={[5, 5, 5]}
                    intensity={2}
                    castShadow
                  />
                  <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    autoRotate
                    autoRotateSpeed={2}
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 3}
                  />
                  <Model
                    avatar={profile.avatar}
                    currentAction="Idle_1"
                    position={[0, -1, 0]}
                  />
                </Canvas>
              </div>

              {/* Vignette/gradient overlay */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0B0714] via-transparent to-transparent z-10" />
            </div>

            {/* Profile Info */}
            <div className="p-6 relative z-20 -mt-10">
              <div className="flex flex-col mb-6">
                <div className="flex items-end justify-between mb-2 bg-black/40 p-4 rounded-sm border border-brand-primary/20 backdrop-blur-sm relative">

                  {/* 2D Avatar Image Small Box */}
                  <div className="absolute right-4 bottom-4 w-12 h-12 bg-black/60 border border-brand-primary/40 rounded-sm overflow-hidden flex items-center justify-center">
                    <img
                      src={`https://www.boozedbunnytown.com/media/avatars/${profile.avatar}_avatar.webp`}
                      alt="Avatar 2D"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pr-14">
                      {profile.name}
                    </h2>
                    <p className="text-[11px] font-black tracking-[0.2em] text-brand-primary uppercase mt-1">
                      {isOwnProfile
                        ? `Level ${getLevelFromXP(profile.experience)} - ${profile.experience} / ${getNextLevelXP(profile.experience)} XP`
                        : `Level ${getLevelFromXP(profile.experience)}`}
                    </p>
                  </div>

                </div>

                {/* XP Progress Bar */}
                {isOwnProfile && (
                  <div className="w-full bg-black/80 border border-white/10 h-2.5 mt-2 relative overflow-hidden rounded-sm shadow-inner">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-primary/50 to-brand-primary shadow-[0_0_10px_rgba(189,0,255,0.5)] transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((profile.experience - getXPForLevel(getLevelFromXP(profile.experience))) / (getNextLevelXP(profile.experience) - getXPForLevel(getLevelFromXP(profile.experience)))) * 100))}%`
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="bg-black/60 border border-white/10 p-5 rounded-sm shadow-lg min-h-[120px] backdrop-blur-md">
                <div className="mb-3 flex justify-between items-center border-b border-brand-primary/20 pb-2">
                  <span className="text-[11px] uppercase font-black text-brand-primary/80 tracking-[0.3em]">
                    Biography Database
                  </span>
                  {isOwnProfile && !isEditing && (
                    <Button
                      onClick={() => setIsEditing(true)}
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] uppercase font-bold text-gray-400"
                    >
                      <Edit3 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Enter your biography here..."
                      className="w-full bg-black/60 border border-brand-primary/40 rounded-none p-3 text-sm text-gray-300 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary min-h-[100px] resize-none"
                      maxLength={500}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        onClick={() => {
                          setIsEditing(false);
                          setEditDescription(profile.description || "");
                        }}
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[10px] uppercase font-bold text-gray-400 hover:text-white"
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        size="sm"
                        disabled={isSaving}
                        className="h-8  bg-brand-primary hover:bg-brand-primary/80 text-[10px] uppercase font-bold"
                      >
                        {isSaving ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                        ) : (
                          <Save className="w-3 h-3 mr-1.5" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
                    {profile.description || (
                      <span className="text-gray-600 italic">
                        No biographical data found in the Neural Archives.
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-40 bg-[length:100%_2px,3px_100%] opacity-30" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

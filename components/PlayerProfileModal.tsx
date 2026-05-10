import { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { X, Save, Edit3, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Model } from "@/components/Player";
import { toast } from "sonner";

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
      <DialogContent className="sm:max-w-[450px] p-0 bg-[#0B0714]/95 border border-white/10 cyber-panel overflow-hidden z-[60]">
        <DialogHeader className="sr-only">
          <DialogTitle>Player Profile</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          </div>
        ) : profile ? (
          <div className="flex flex-col relative">
            {/* Header / Avatar Area */}
            <div className="h-48 relative bg-black/40 border-b border-brand-primary/30 flex items-center justify-center overflow-hidden">
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
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0B0714] to-transparent z-10" />

              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-20 bg-black/50 hover:bg-white/10 p-1.5 rounded-md text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="p-6 relative z-20 -mt-8">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white drop-shadow-md">
                    {profile.name}
                  </h2>
                  <p className="text-[10px] font-black tracking-widest text-brand-primary uppercase">
                    Citizen Level
                  </p>
                </div>

                {isOwnProfile && !isEditing && (
                  <Button
                    onClick={() => setIsEditing(true)}
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 bg-white/5 hover:bg-white/10 border border-white/10 cyber-skew text-[10px] uppercase font-bold text-gray-300"
                  >
                    <Edit3 className="w-3 h-3 mr-1.5" />
                    Edit
                  </Button>
                )}
              </div>

              <div className="bg-black/40 border border-white/5 p-4 cyber-panel-inner min-h-[100px]">
                <div className="mb-2 flex justify-between items-center">
                  <span className="text-[10px] uppercase font-black text-gray-500 tracking-[0.4em]">
                    Biography Database
                  </span>
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
                        className="h-8 cyber-skew bg-brand-primary hover:bg-brand-primary/80 text-[10px] uppercase font-bold"
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

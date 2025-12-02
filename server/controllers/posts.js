import mongoose from 'mongoose';
import Joi from 'joi';
import BigNumber from 'bignumber.js';
import PostMessage from '../models/postMessage.js';

// Validation Schema
const postSchemaVal = Joi.object({
  title: Joi.string().required(),
  message: Joi.string().required(),
  tags: Joi.array().items(Joi.string()),
  selectedFile: Joi.string().allow(''),
  price: Joi.number().positive().required(), // Ensure positive
  amount: Joi.number().positive().required(), // Ensure positive
});

export const getPosts = async (req, res) => {
  try {
    const postMessages = await PostMessage.find();
    res.status(200).json(postMessages);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

export const createPost = async (req, res) => {
  const post = req.body;

  // 1. Validate Input
  const { error } = postSchemaVal.validate({
    title: post.title,
    message: post.message,
    tags: post.tags,
    selectedFile: post.selectedFile,
    price: post.price,
    amount: post.amount,
  });

  if (error) return res.status(400).json({ message: error.details[0].message });

  // 2. Secure Math Calculation
  const safePrice = new BigNumber(post.price);
  const safeAmount = new BigNumber(post.amount);

  const newPost = new PostMessage({
    ...post,
    price: safePrice.toString(), // Store as string
    amount: safeAmount.toString(), // Store as string
    creator: req.userId,
    createdAt: new Date().toISOString(),
  });

  try {
    await newPost.save();
    res.status(201).json(newPost);
  } catch (error) {
    res.status(409).json({ message: error.message });
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;
  const post = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).send('No post with that id');

  const { error } = postSchemaVal.validate({
    title: post.title,
    message: post.message,
    tags: post.tags,
    selectedFile: post.selectedFile,
    price: post.price,
    amount: post.amount,
  });

  if (error) return res.status(400).json({ message: error.details[0].message });

  const safePrice = new BigNumber(post.price);
  const safeAmount = new BigNumber(post.amount);

  const updatedPost = await PostMessage.findByIdAndUpdate(
    id,
    { ...post, price: safePrice.toString(), amount: safeAmount.toString(), _id: id },
    { new: true },
  );

  return res.json(updatedPost);
};

export const deletePost = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).send('No post with that id');

  await PostMessage.findByIdAndRemove(id);

  return res.json({ message: 'Post deleted successfully' });
};

export const likePost = async (req, res) => {
  const { id } = req.params;

  if (!req.userId) return res.status(401).json({ message: 'Unauthenticated' });

  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).send('No post with that id');

  const post = await PostMessage.findById(id);

  const index = post.likes.findIndex((uid) => uid === String(req.userId));

  if (index === -1) {
    post.likes.push(req.userId);
  } else {
    post.likes = post.likes.filter((uid) => uid !== String(req.userId));
  }

  const updatedPost = await PostMessage.findByIdAndUpdate(id, post, { new: true });

  return res.json(updatedPost);
};

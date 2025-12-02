import mongoose from 'mongoose';
import Joi from 'joi';
import BigNumber from 'bignumber.js';
import PostMessage from '../models/postMessage.js';

// Exported so tests can import it
export const postSchemaVal = Joi.object({
  title: Joi.string().required(),
  message: Joi.string().required(),
  tags: Joi.array().items(Joi.string()),
  selectedFile: Joi.string().allow(''),
  price: Joi.number().positive().required(),
  amount: Joi.number().positive().required(),
});

export const getPosts = async (req, res) => {
  try {
    // Only return posts for the authenticated user
    const query = req.userId ? { creator: String(req.userId) } : {};
    const postMessages = await PostMessage.find(query);

    const formatted = postMessages.map((post) => ({
      ...post._doc,
      price: post.price?.toString(),
      amount: post.amount?.toString(),
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};

export const createPost = async (req, res) => {
  const post = req.body;

  const { error } = postSchemaVal.validate({
    title: post.title,
    message: post.message,
    tags: post.tags,
    selectedFile: post.selectedFile,
    price: post.price,
    amount: post.amount,
  });

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const safePrice = new BigNumber(post.price);
  const safeAmount = new BigNumber(post.amount);

  const newPost = new PostMessage({
    ...post,
    price: safePrice.toString(),
    amount: safeAmount.toString(),
    creator: req.userId,
    createdAt: new Date().toISOString(),
  });

  try {
    await newPost.save();
    return res.status(201).json(newPost);
  } catch (err) {
    return res.status(409).json({ message: err.message });
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;
  const post = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).send('No post with that id');
  }

  const existingPost = await PostMessage.findById(id);
  if (!existingPost) {
    return res.status(404).send('No post with that id');
  }

  // Ownership check
  if (existingPost.creator !== String(req.userId)) {
    return res
      .status(403)
      .json({ message: 'Unauthorized. You can only update your own assets.' });
  }

  const { error } = postSchemaVal.validate({
    title: post.title,
    message: post.message,
    tags: post.tags,
    selectedFile: post.selectedFile,
    price: post.price,
    amount: post.amount,
  });

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const safePrice = new BigNumber(post.price);
  const safeAmount = new BigNumber(post.amount);

  const updatedPost = await PostMessage.findByIdAndUpdate(
    id,
    {
      ...post,
      price: safePrice.toString(),
      amount: safeAmount.toString(),
      _id: id,
      creator: existingPost.creator,
    },
    { new: true },
  );

  return res.json(updatedPost);
};

export const deletePost = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).send('No post with that id');
  }

  const post = await PostMessage.findById(id);
  if (!post) {
    return res.status(404).send('No post with that id');
  }

  // Ownership check
  if (post.creator !== String(req.userId)) {
    return res
      .status(403)
      .json({ message: 'Unauthorized. You can only delete your own assets.' });
  }

  await PostMessage.findByIdAndRemove(id);

  return res.json({ message: 'Post deleted successfully' });
};

export const likePost = async (req, res) => {
  const { id } = req.params;

  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).send('No post with that id');
  }

  const post = await PostMessage.findById(id);

  const index = post.likes.findIndex(
    (uid) => uid === String(req.userId),
  );

  if (index === -1) {
    post.likes.push(req.userId);
  } else {
    post.likes = post.likes.filter((uid) => uid !== String(req.userId));
  }

  const updatedPost = await PostMessage.findByIdAndUpdate(id, post, {
    new: true,
  });

  return res.json(updatedPost);
};

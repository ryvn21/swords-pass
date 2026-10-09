import test from 'node:test';
import assert from 'node:assert/strict';
import {offensive, allowedName} from '../dist/name-filter.js';

test('offensive names are caught, including disguised spellings', () => {
  for (const n of ['nigger', 'N1GG3R', 'n.i.g.g.a', 'niiiigger', 'Faggot99', 'f@gg0t', 'HitlerFan', 'xX_rapist_Xx', 'k k k', 'KKKlan', 'ped0', 'SiegHeil', 'nazi', 'Big Cock', 'kys', 'killyourself', 'retard', 'cunt', 'FuckYou', 'paki', 'spic', '1488', 'chink', 'tranny', 'whore'])
    assert.equal(offensive(n), true, n);
});
test('ordinary names pass, including ones that contain a blocked word', () => {
  for (const n of ['Swordhand', 'Ryan', 'Scunthorpe Steve', 'therapist', 'Grape Ape', 'Nigeria', 'Peacock', 'cocktail', 'analyst', 'Spicy', 'Penistone', 'Dickens', 'Torpedo', 'Speedo', 'Nazir', 'Mongolia', 'Anushka', 'Montenegro', 'Sassy', 'Kirk', 'Pakistan', 'Japan', 'Raccoon', 'Scrapper', 'Draper', 'Killer Queen', 'Assassin'])
    assert.equal(offensive(n), false, n);
  assert.equal(allowedName('nigger'), 'Swordhand');
  assert.equal(allowedName('Ryan'), 'Ryan');
});

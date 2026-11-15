
create   view [STF].[VWStuffgroup]
as

SELECT  StuffGroupID, 
		ParentID, 
		Title, 
		Title2, 
		Code, 
		Version, 
		Creator, 
		CreationDate, 
		LastEditor, 
		LastEditionDate, 
		Type,
		stf.StuffGroupFullCode(StuffGroupID) FullCode
FROM  STF.StuffGroup
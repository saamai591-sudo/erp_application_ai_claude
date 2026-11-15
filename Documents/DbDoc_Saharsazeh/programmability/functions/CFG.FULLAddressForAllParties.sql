
CREATE    FUNCTION [CFG].FULLAddressForAllParties ()
RETURNS @FullAddress TABLE 
(
  AddressID int PRIMARY KEY NOT NULL, 
  AddressTypeID int NOT NULL,
  IsMain bit NOT NULL,
  [Address] nvarchar(256)NOT NULL,
  [Address2] nvarchar(256)NOT NULL,
  ZipCode varchar(200) NULL,
  PartyID int NOT NULL,
  partyTitle nvarchar(256)NOT NULL,
  country nvarchar(256)NOT NULL,
  province nvarchar(256)NOT NULL,
  provinceMinistryCode nvarchar(256) NULL,
  county nvarchar(256)NOT NULL,
  countyMinistryCode nvarchar(256) NULL,
  city nvarchar(256)NOT NULL,
  cityMinistryCode nvarchar(256) NULL,
  PreNumber nvarchar(256) NULL
)
  --WITH ENCRYPTION
	 AS
BEGIN
  
  insert @FullAddress
  
  select 
 a.AddressID,
 a.AddressTypeID,
 a.IsMain,
 a.Address ,
 a.Address2,
 Ltrim(Rtrim(a.ZipCode)),
 f.PartyID,
 f.Title,
 country.Title ,
 province.Title ,
 province.FinancialMinistryCode,
 county.Title ,
 country.FinancialMinistryCode,
 city.Title ,
 city.FinancialMinistryCode,
 city.PreNumberOfCity

	 from cfg.[Address] a
	join CFG.Location city on city.LocationID = a.LocationID
	join CFG.Location county on county.LocationID = city.ParentID
	join CFG.Location province on province.LocationID = county.ParentID
	join CFG.Location country on country.LocationID = province.ParentID
	join CFG.Party f on f.PartyID=a.PartyID

RETURN 
END;

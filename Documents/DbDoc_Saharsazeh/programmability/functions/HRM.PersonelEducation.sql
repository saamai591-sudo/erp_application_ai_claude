
CREATE   function [HRM].PersonelEducation()
RETURNS @Result TABLE
(
Id int,
PersonelID int,
PersonelCode varchar(50),
PersonelName nvarchar(500),
LastName  nvarchar(500),
Institute nvarchar(500),
Field nvarchar(500),
Average decimal(5,2),
CertificateType nvarchar(500),
StartDate nvarchar(50),
EndDate nvarchar(50),
DegreeType nvarchar(500)
)
--with encryption
AS
begin
    DECLARE @CultureNo int;

	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = cfg.GetuserCulture();	
	
INSERT INTO @Result
SELECT e.EducationID                  AS Id,
       p.PersonelID,
       p.Code                         AS PersonelCode,
       case when @CultureNo = 1 then p2.Title else p2.Title2 end PersonelName,
       case when @CultureNo = 1 then p2.LastName else p2.LastName2 end LastName,
       case when @CultureNo = 1 then i.Title else i.Title2 end Institute,
	   case when @CultureNo = 1 then sf.Title else sf.Title2 end AS Field,
       e.Average,
       case when @CultureNo = 1 then ct.Title else ct.Title2 end CertificateType,
       cfg.GetCLRSaturnDate(e.StartDate, 'YYYY/MM/DD', 0, 0) AS StartDate,
       cfg.GetCLRSaturnDate(e.EndDate, 'YYYY/MM/DD', 0, 0) AS EndDate,
       case when @CultureNo = 1 then sd.Title else sd.Title2 end DegreeType
FROM   hrm.Education                  AS e
       INNER JOIN HRM.Personel        AS p
            ON  p.PersonelID = e.PersonelID
       INNER JOIN CFG.Party           AS p2
            ON  p2.PartyID = p.PartyID
       LEFT JOIN HRM.Institue         AS i
            ON  i.InstitueID = e.InstituteID
       LEFT JOIN HRM.StudyDegree      AS sd
            ON  sd.StudyDegreeID = e.StudyDegreeID
       LEFT JOIN HRM.StudyField       AS sf
            ON  sf.StudyFieldID = e.StudyFieldID
       LEFT JOIN HRM.CertificateType  AS ct
            ON  ct.CertificateTypeID = e.CertificateTypeID 



	    RETURN;
end
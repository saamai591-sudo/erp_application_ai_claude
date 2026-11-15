
CREATE      PROCEDURE [ATN].spGetVacancyBalanceForRequest
(@PersonelID INT, @VacancyBalance DECIMAL(36, 4) = 0 OUTPUT)
AS
	
	select @VacancyBalance =  sum(AddedVacancy - DeductedVacancy) from atn.vwVacancyCardex
	where PersonelID = @PersonelID
